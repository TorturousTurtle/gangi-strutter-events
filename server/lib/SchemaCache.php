<?php
/**
 * Schema Cache
 *
 * Caches database column existence checks in memory to avoid
 * repeated SHOW COLUMNS queries. Uses a single information_schema
 * query to fetch all columns for a table at once.
 */

class SchemaCache
{
    /**
     * In-memory cache of table schemas.
     * Structure: ['tableName' => ['column1', 'column2', ...]]
     *
     * @var array<string, array<string>>
     */
    private static array $cache = [];

    /**
     * PDO instance for database queries.
     *
     * @var PDO|null
     */
    private static ?PDO $pdo = null;

    /**
     * Set the PDO instance to use for queries.
     *
     * @param PDO $pdo
     */
    public static function setPdo(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }

    /**
     * Get the PDO instance, falling back to Database singleton.
     *
     * @return PDO
     * @throws RuntimeException If no PDO instance available
     */
    private static function getPdo(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // Try to use Database singleton if available
        if (class_exists('Database')) {
            self::$pdo = Database::getInstance();
            return self::$pdo;
        }

        throw new RuntimeException('SchemaCache: No PDO instance available. Call SchemaCache::setPdo() first.');
    }

    /**
     * Check if a column exists in a table.
     *
     * @param string $table Table name
     * @param string $column Column name
     * @return bool True if the column exists
     */
    public static function hasColumn(string $table, string $column): bool
    {
        $columns = self::getColumns($table);
        return in_array($column, $columns, true);
    }

    /**
     * Check if multiple columns exist in a table.
     * Returns an associative array of column => exists.
     *
     * @param string $table Table name
     * @param array<string> $columns Column names to check
     * @return array<string, bool> Associative array of column => exists
     */
    public static function hasColumns(string $table, array $columns): array
    {
        $tableColumns = self::getColumns($table);
        $result = [];

        foreach ($columns as $column) {
            $result[$column] = in_array($column, $tableColumns, true);
        }

        return $result;
    }

    /**
     * Get all column names for a table.
     *
     * @param string $table Table name
     * @return array<string> List of column names
     */
    public static function getColumns(string $table): array
    {
        // Return from cache if available
        if (isset(self::$cache[$table])) {
            return self::$cache[$table];
        }

        // Load columns from database
        self::loadTableSchema($table);

        return self::$cache[$table] ?? [];
    }

    /**
     * Pre-warm the cache for one or more tables.
     * Useful at the start of a request to batch-load schemas.
     *
     * @param string|array<string> $tables Table name(s) to warm
     */
    public static function warmCache(string|array $tables): void
    {
        $tables = (array) $tables;

        foreach ($tables as $table) {
            if (!isset(self::$cache[$table])) {
                self::loadTableSchema($table);
            }
        }
    }

    /**
     * Clear the cache for a specific table or all tables.
     *
     * @param string|null $table Table name, or null to clear all
     */
    public static function clearCache(?string $table = null): void
    {
        if ($table === null) {
            self::$cache = [];
        } else {
            unset(self::$cache[$table]);
        }
    }

    /**
     * Load schema for a single table into cache.
     *
     * @param string $table Table name
     */
    private static function loadTableSchema(string $table): void
    {
        try {
            $pdo = self::getPdo();

            // Use information_schema for a single efficient query
            // This is more efficient than SHOW COLUMNS for multiple column checks
            $stmt = $pdo->prepare("
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            ");
            $stmt->execute([$table]);

            $columns = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[] = $row['COLUMN_NAME'];
            }

            self::$cache[$table] = $columns;
        } catch (Throwable $e) {
            // On error, cache an empty array to avoid repeated failures
            self::$cache[$table] = [];
            error_log("[SchemaCache] Failed to load schema for table '{$table}': " . $e->getMessage());
        }
    }

    /**
     * Get column metadata (type, nullability, etc.) for a table.
     * Returns detailed information about each column.
     *
     * @param string $table Table name
     * @return array<string, array> Associative array of column => metadata
     */
    public static function getColumnMetadata(string $table): array
    {
        try {
            $pdo = self::getPdo();

            $stmt = $pdo->prepare("
                SELECT
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_DEFAULT,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            ");
            $stmt->execute([$table]);

            $metadata = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columnName = $row['COLUMN_NAME'];
                $metadata[$columnName] = [
                    'type' => $row['DATA_TYPE'],
                    'nullable' => strtoupper($row['IS_NULLABLE']) === 'YES',
                    'default' => $row['COLUMN_DEFAULT'],
                    'maxLength' => $row['CHARACTER_MAXIMUM_LENGTH'],
                    'precision' => $row['NUMERIC_PRECISION'],
                    'scale' => $row['NUMERIC_SCALE'],
                ];
            }

            return $metadata;
        } catch (Throwable $e) {
            error_log("[SchemaCache] Failed to get column metadata for table '{$table}': " . $e->getMessage());
            return [];
        }
    }

    /**
     * Check if a column is nullable.
     *
     * @param string $table Table name
     * @param string $column Column name
     * @return bool True if nullable, false if not or column doesn't exist
     */
    public static function isColumnNullable(string $table, string $column): bool
    {
        $metadata = self::getColumnMetadata($table);
        return $metadata[$column]['nullable'] ?? false;
    }
}
