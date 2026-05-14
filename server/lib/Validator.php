<?php
/**
 * Input Validation Helper
 *
 * Provides validation rules and utilities for sanitizing/validating user input.
 */

class Validator
{
    private array $data;
    private array $errors = [];
    private array $validated = [];

    /**
     * Create a new validator instance.
     *
     * @param array $data Data to validate
     */
    public function __construct(array $data)
    {
        $this->data = $data;
    }

    /**
     * Create a validator instance.
     *
     * @param array $data Data to validate
     * @return static
     */
    public static function make(array $data): static
    {
        return new static($data);
    }

    /**
     * Validate a required field.
     *
     * @param string $field Field name
     * @param string|null $message Custom error message
     * @return $this
     */
    public function required(string $field, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value === null || $value === '' || (is_array($value) && empty($value))) {
            $this->addError($field, $message ?? "$field is required");
        } else {
            $this->validated[$field] = $value;
        }

        return $this;
    }

    /**
     * Validate an optional field (just stores the value if present).
     *
     * @param string $field Field name
     * @param mixed $default Default value if not present
     * @return $this
     */
    public function optional(string $field, mixed $default = null): static
    {
        $value = $this->getValue($field);
        $this->validated[$field] = $value ?? $default;
        return $this;
    }

    /**
     * Validate email format.
     *
     * @param string $field Field name
     * @param string|null $message Custom error message
     * @return $this
     */
    public function email(string $field, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $this->addError($field, $message ?? "$field must be a valid email address");
            } else {
                $this->validated[$field] = $value;
            }
        }

        return $this;
    }

    /**
     * Validate minimum string length.
     *
     * @param string $field Field name
     * @param int $min Minimum length
     * @param string|null $message Custom error message
     * @return $this
     */
    public function minLength(string $field, int $min, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && strlen($value) < $min) {
            $this->addError($field, $message ?? "$field must be at least $min characters");
        }

        return $this;
    }

    /**
     * Validate maximum string length.
     *
     * @param string $field Field name
     * @param int $max Maximum length
     * @param string|null $message Custom error message
     * @return $this
     */
    public function maxLength(string $field, int $max, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && strlen($value) > $max) {
            $this->addError($field, $message ?? "$field must be no more than $max characters");
        }

        return $this;
    }

    /**
     * Validate numeric value.
     *
     * @param string $field Field name
     * @param string|null $message Custom error message
     * @return $this
     */
    public function numeric(string $field, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && !is_numeric($value)) {
            $this->addError($field, $message ?? "$field must be a number");
        } else if ($value !== null && $value !== '') {
            $this->validated[$field] = (float) $value;
        }

        return $this;
    }

    /**
     * Validate integer value.
     *
     * @param string $field Field name
     * @param string|null $message Custom error message
     * @return $this
     */
    public function integer(string $field, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_INT) && $value !== '0' && $value !== 0) {
                $this->addError($field, $message ?? "$field must be an integer");
            } else {
                $this->validated[$field] = (int) $value;
            }
        }

        return $this;
    }

    /**
     * Validate minimum numeric value.
     *
     * @param string $field Field name
     * @param float $min Minimum value
     * @param string|null $message Custom error message
     * @return $this
     */
    public function min(string $field, float $min, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && is_numeric($value) && (float) $value < $min) {
            $this->addError($field, $message ?? "$field must be at least $min");
        }

        return $this;
    }

    /**
     * Validate maximum numeric value.
     *
     * @param string $field Field name
     * @param float $max Maximum value
     * @param string|null $message Custom error message
     * @return $this
     */
    public function max(string $field, float $max, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && is_numeric($value) && (float) $value > $max) {
            $this->addError($field, $message ?? "$field must be no more than $max");
        }

        return $this;
    }

    /**
     * Validate value is in a list of allowed values.
     *
     * @param string $field Field name
     * @param array $allowed Allowed values
     * @param string|null $message Custom error message
     * @return $this
     */
    public function in(string $field, array $allowed, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && !in_array($value, $allowed, true)) {
            $this->addError($field, $message ?? "$field must be one of: " . implode(', ', $allowed));
        }

        return $this;
    }

    /**
     * Validate against a regex pattern.
     *
     * @param string $field Field name
     * @param string $pattern Regex pattern
     * @param string|null $message Custom error message
     * @return $this
     */
    public function pattern(string $field, string $pattern, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && !preg_match($pattern, $value)) {
            $this->addError($field, $message ?? "$field format is invalid");
        }

        return $this;
    }

    /**
     * Validate date format.
     *
     * @param string $field Field name
     * @param string $format Expected date format (default Y-m-d)
     * @param string|null $message Custom error message
     * @return $this
     */
    public function date(string $field, string $format = 'Y-m-d', ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            $date = DateTime::createFromFormat($format, $value);
            if (!$date || $date->format($format) !== $value) {
                $this->addError($field, $message ?? "$field must be a valid date");
            }
        }

        return $this;
    }

    /**
     * Validate boolean value.
     *
     * @param string $field Field name
     * @return $this
     */
    public function boolean(string $field): static
    {
        $value = $this->getValue($field);

        if ($value !== null) {
            $this->validated[$field] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
        }

        return $this;
    }

    /**
     * Validate array value.
     *
     * @param string $field Field name
     * @param string|null $message Custom error message
     * @return $this
     */
    public function array(string $field, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && !is_array($value)) {
            $this->addError($field, $message ?? "$field must be an array");
        } else if ($value !== null) {
            $this->validated[$field] = $value;
        }

        return $this;
    }

    /**
     * Validate JSON string.
     *
     * @param string $field Field name
     * @param string|null $message Custom error message
     * @return $this
     */
    public function json(string $field, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            json_decode($value);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->addError($field, $message ?? "$field must be valid JSON");
            } else {
                $this->validated[$field] = $value;
            }
        }

        return $this;
    }

    /**
     * Sanitize and store a string field (trim, strip tags).
     *
     * @param string $field Field name
     * @return $this
     */
    public function sanitize(string $field): static
    {
        $value = $this->getValue($field);

        if ($value !== null && is_string($value)) {
            $this->validated[$field] = trim(strip_tags($value));
        }

        return $this;
    }

    /**
     * Apply a custom validation callback.
     *
     * @param string $field Field name
     * @param callable $callback Function that returns true if valid, false/string if invalid
     * @param string|null $message Default error message
     * @return $this
     */
    public function custom(string $field, callable $callback, ?string $message = null): static
    {
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            $result = $callback($value, $this->data);

            if ($result === false) {
                $this->addError($field, $message ?? "$field is invalid");
            } else if (is_string($result)) {
                $this->addError($field, $result);
            }
        }

        return $this;
    }

    /**
     * Get a value from the input data.
     *
     * @param string $field Field name (supports dot notation)
     * @return mixed
     */
    private function getValue(string $field): mixed
    {
        // Support dot notation for nested fields
        $keys = explode('.', $field);
        $value = $this->data;

        foreach ($keys as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                return null;
            }
            $value = $value[$key];
        }

        return $value;
    }

    /**
     * Add a validation error.
     *
     * @param string $field Field name
     * @param string $message Error message
     */
    private function addError(string $field, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }

    /**
     * Check if validation passed.
     *
     * @return bool
     */
    public function passes(): bool
    {
        return empty($this->errors);
    }

    /**
     * Check if validation failed.
     *
     * @return bool
     */
    public function fails(): bool
    {
        return !empty($this->errors);
    }

    /**
     * Get all validation errors.
     *
     * @return array Errors keyed by field name
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Get the first error message.
     *
     * @return string|null
     */
    public function firstError(): ?string
    {
        foreach ($this->errors as $fieldErrors) {
            return $fieldErrors[0] ?? null;
        }
        return null;
    }

    /**
     * Get validated data.
     *
     * @return array
     */
    public function validated(): array
    {
        return $this->validated;
    }

    /**
     * Get a specific validated value.
     *
     * @param string $field Field name
     * @param mixed $default Default if not present
     * @return mixed
     */
    public function get(string $field, mixed $default = null): mixed
    {
        return $this->validated[$field] ?? $default;
    }
}
