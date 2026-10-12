<?php
// Fælles opsætning for alle PHP-endpoints: config, database, fejl, hjælpefunktioner.
declare(strict_types=1);

require_once __DIR__ . '/layout.php';

function md_config(): array
{
    static $config = null;
    if ($config === null) {
        $file = getenv('MD_CONFIG') ?: __DIR__ . '/config.php';
        if (!is_file($file)) {
            error_log('madslundnielsen.dk: config.php mangler');
            md_error_page(500, 'Siden er ikke sat op endnu', 'Prøv igen senere.');
        }
        $config = require $file;
    }
    return $config;
}

function md_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = md_config()['db'];
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int) ($c['port'] ?? 3306), $c['name']);
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        // Alle DATETIME-kolonner gemmes i UTC.
        $pdo->exec("SET time_zone = '+00:00'");
        md_ensure_schema($pdo);
    }
    return $pdo;
}

// Opretter tabellerne første gang, så phpMyAdmin-import er unødvendigt.
// Hold i trit med database/schema.sql.
function md_ensure_schema(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS inquiries (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name          VARCHAR(120) NOT NULL,
      email         VARCHAR(190) NOT NULL,
      company       VARCHAR(190) NULL,
      cvr           VARCHAR(8) NULL,
      interest      VARCHAR(40) NOT NULL COMMENT \'halv, hel, vsme, keynote, bestyrelse, bog, andet\',
      participants  INT UNSIGNED NULL,
      message       TEXT NULL,
      ip_hash       CHAR(64) NULL COMMENT \'SHA-256 af IP + hemmeligt salt, kun til misbrugskontrol\',
      mail_sent     TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'1 = notifikationsmail afleveret til mail()\',
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inquiries_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $pdo->exec('CREATE TABLE IF NOT EXISTS newsletter (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email       VARCHAR(190) NOT NULL,
      name        VARCHAR(120) NULL,
      source      VARCHAR(60) NULL,
      consent     VARCHAR(255) NOT NULL COMMENT \'Samtykketeksten, som den stod ved tilmelding\',
      consent_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT \'UTC\',
      ip_hash     CHAR(64) NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_newsletter_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function md_wants_json(): bool
{
    return str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
}

function md_json(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function md_redirect(string $url, int $status = 303): void
{
    header('Location: ' . $url, true, $status);
    exit;
}

function md_error_page(int $status, string $title, string $message, string $linkHref = '/', string $linkText = 'Til forsiden'): void
{
    http_response_code($status);
    md_page_start($title);
    echo '<section class="nf"><h1>' . h($title) . '</h1>';
    echo '<p>' . h($message) . '</p>';
    echo '<p><a class="btn btn--copper" href="' . h($linkHref) . '">' . h($linkText) . '</a></p>';
    echo '</section>';
    md_page_end();
    exit;
}

function md_ip_hash(): ?string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return $ip !== '' ? hash('sha256', $ip . (md_config()['ip_salt'] ?? '')) : null;
}

// Fjerner linjeskift m.m., så brugerinput aldrig kan injicere mailheaders.
function md_header_safe(string $value): string
{
    return trim(preg_replace('/[\r\n\0]+/', ' ', $value));
}

// Vis aldrig stacktraces for besøgende; log dem til hostingens fejllog.
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e): void {
    error_log('madslundnielsen.dk: ' . $e);
    $debug = false;
    try {
        $debug = !empty(md_config()['debug']);
    } catch (Throwable $ignored) {
    }
    if (!headers_sent()) {
        if (md_wants_json()) {
            md_json(500, ['ok' => false, 'message' => 'Noget gik galt. Prøv igen om lidt.']);
        }
        md_error_page(500, 'Noget gik galt', $debug ? (string) $e : 'Prøv igen om lidt. Hvis det bliver ved, så skriv til mads@qlim8.com.');
    }
});

date_default_timezone_set('UTC');
