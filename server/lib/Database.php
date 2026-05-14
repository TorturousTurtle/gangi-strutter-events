<?php
/**
 * Database Connection Manager
 *
 * Provides a singleton PDO connection with lazy loading and
 * helper methods for common database operations.
 */

class Database
{
    private static ?PDO $instance = null;
    private static array $config = [];

    /**
     * Configure the database connection.
     * Call this before getInstance() to set custom config.
     *
     * @param array $config Database configuration array
     */
    public static function configure(array $config): void
    {
        self::$config = $config;
        // Reset instance if reconfiguring
        self::$instance = null;
    }

    /**
     * Get the singleton PDO instance.
     *
     * @return PDO
     * @throws PDOException If connection fails
     */
    public static function getInstance(): PDO
    {
        if (self::$instance === null) {
            self::$instance = self::createConnection();
        }

        return self::$instance;
    }

    /**
     * Create a new PDO connection.
     *
     * @return PDO
     * @throws PDOException If connection fails
     */
    private static function createConnection(): PDO
    {
        $config = self::getConfig();

        $dsn = sprintf(
            "mysql:host=%s;dbname=%s;charset=%s",
            $config['host'],
            $config['name'],
            $config['charset'] ?? 'utf8mb4'
        );

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        // Use the new constant name for PHP 8.5+, fallback to old name
        if (class_exists('Pdo\Mysql') && defined('Pdo\Mysql::ATTR_FOUND_ROWS')) {
            $options[\Pdo\Mysql::ATTR_FOUND_ROWS] = true;
        } else {
            $options[PDO::MYSQL_ATTR_FOUND_ROWS] = true;
        }

        return new PDO($dsn, $config['user'], $config['pass'], $options);
    }

    /**
     * Get database configuration from config file or self::$config.
     *
     * @return array
     * @throws RuntimeException If config is not set
     */
    private static function getConfig(): array
    {
        if (!empty(self::$config)) {
            return self::$config;
        }

        // Try to load from server/config.php
        $configFile = dirname(__DIR__) . '/config.php';
        if (file_exists($configFile)) {
            $config = require $configFile;
            if (isset($config['db'])) {
                self::$config = $config['db'];
                return self::$config;
            }
        }

        throw new RuntimeException('Database configuration not found. Call Database::configure() first.');
    }

    /**
     * Execute a SELECT query and return all rows.
     *
     * @param string $sql SQL query with placeholders
     * @param array $params Parameters for prepared statement
     * @return array Array of rows
     */
    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Execute a SELECT query and return a single row.
     *
     * @param string $sql SQL query with placeholders
     * @param array $params Parameters for prepared statement
     * @return array|null Row data or null if not found
     */
    public static function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Execute a SELECT query and return a single column value.
     *
     * @param string $sql SQL query with placeholders
     * @param array $params Parameters for prepared statement
     * @return mixed Column value or null
     */
    public static function fetchColumn(string $sql, array $params = []): mixed
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    /**
     * Execute an INSERT/UPDATE/DELETE query.
     *
     * @param string $sql SQL query with placeholders
     * @param array $params Parameters for prepared statement
     * @return int Number of affected rows
     */
    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /**
     * Insert a row and return the last insert ID.
     *
     * @param string $table Table name
     * @param array $data Associative array of column => value
     * @return int Last insert ID
     */
    public static function insert(string $table, array $data): int
    {
        $columns = array_keys($data);
        $placeholders = array_fill(0, count($columns), '?');

        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $columns),
            implode(', ', $placeholders)
        );

        self::execute($sql, array_values($data));
        return (int) self::getInstance()->lastInsertId();
    }

    /**
     * Update rows in a table.
     *
     * @param string $table Table name
     * @param array $data Associative array of column => value
     * @param string $where WHERE clause (without 'WHERE')
     * @param array $whereParams Parameters for WHERE clause
     * @return int Number of affected rows
     */
    public static function update(string $table, array $data, string $where, array $whereParams = []): int
    {
        $setClauses = array_map(fn($col) => "$col = ?", array_keys($data));

        $sql = sprintf(
            'UPDATE %s SET %s WHERE %s',
            $table,
            implode(', ', $setClauses),
            $where
        );

        $params = array_merge(array_values($data), $whereParams);
        return self::execute($sql, $params);
    }

    /**
     * Delete rows from a table.
     *
     * @param string $table Table name
     * @param string $where WHERE clause (without 'WHERE')
     * @param array $params Parameters for WHERE clause
     * @return int Number of deleted rows
     */
    public static function delete(string $table, string $where, array $params = []): int
    {
        $sql = sprintf('DELETE FROM %s WHERE %s', $table, $where);
        return self::execute($sql, $params);
    }

    /**
     * Begin a transaction.
     */
    public static function beginTransaction(): void
    {
        self::getInstance()->beginTransaction();
    }

    /**
     * Commit the current transaction.
     */
    public static function commit(): void
    {
        self::getInstance()->commit();
    }

    /**
     * Roll back the current transaction.
     */
    public static function rollback(): void
    {
        self::getInstance()->rollBack();
    }

    /**
     * Execute a callback within a transaction.
     *
     * @param callable $callback Function to execute
     * @return mixed Return value of the callback
     * @throws Throwable Re-throws any exception after rollback
     */
    public static function transaction(callable $callback): mixed
    {
        self::beginTransaction();

        try {
            $result = $callback(self::getInstance());
            self::commit();
            return $result;
        } catch (Throwable $e) {
            self::rollback();
            throw $e;
        }
    }

    /**
     * Check if a row exists.
     *
     * @param string $table Table name
     * @param string $where WHERE clause
     * @param array $params Parameters
     * @return bool
     */
    public static function exists(string $table, string $where, array $params = []): bool
    {
        $sql = sprintf('SELECT 1 FROM %s WHERE %s LIMIT 1', $table, $where);
        return self::fetchColumn($sql, $params) !== false;
    }

    /**
     * Get the last insert ID.
     *
     * @return int
     */
    public static function lastInsertId(): int
    {
        return (int) self::getInstance()->lastInsertId();
    }

    /**
     * Close the database connection.
     */
    public static function close(): void
    {
        self::$instance = null;
    }
}
