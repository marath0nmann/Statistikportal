<?php
// Wird auch von Schwesterportalen (Login/Planung/Training) per Stub geladen –
// dort ist die config.php bereits gesetzt; deshalb defensiv.
if (!defined('DB_NAME')) require_once __DIR__ . '/config.php';

class DB {
    private static ?PDO $pdo = null;

    public static function get(): PDO {
        if (self::$pdo === null) {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s',
                DB_HOST, DB_PORT, DB_NAME, DB_CHARSET);
            self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    // Tabellenname mit konfiguriertem Prefix
    public static function tbl(string $name): string {
        return (defined('TABLE_PREFIX') ? TABLE_PREFIX : '') . $name;
    }

    public static function query(string $sql, array $params = []): \PDOStatement {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function fetchAll(string $sql, array $params = []): array {
        return self::query($sql, $params)->fetchAll();
    }

    public static function fetchOne(string $sql, array $params = []): ?array {
        $row = self::query($sql, $params)->fetch();
        return $row ?: null;
    }

    public static function lastInsertId(): string {
        return self::get()->lastInsertId();
    }

    // Dynamisches UPDATE: $felder = ['col=?', ...], $params = passende Werte
    public static function updateById(string $table, array $felder, array $params, $id, string $idCol = 'id'): int {
        $params[] = $id;
        return self::query("UPDATE $table SET " . implode(',', $felder) . " WHERE $idCol=?", $params)->rowCount();
    }

    // INSERT mit Assoc-Array: ['col' => 'wert', ...]; gibt lastInsertId zurück.
    public static function insert(string $table, array $data): string {
        $cols = array_keys($data);
        $ph   = array_fill(0, count($cols), '?');
        $sql  = "INSERT INTO $table (" . implode(',', $cols) . ") VALUES (" . implode(',', $ph) . ")";
        self::query($sql, array_values($data));
        return self::lastInsertId();
    }

    // DELETE … WHERE $idCol = ?
    public static function deleteById(string $table, $id, string $idCol = 'id'): int {
        return self::query("DELETE FROM $table WHERE $idCol=?", [$id])->rowCount();
    }
}
