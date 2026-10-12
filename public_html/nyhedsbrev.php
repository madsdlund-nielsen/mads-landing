<?php
// Nyhedsbrev-tilmelding (POST fra alle sider; JSON til fetch, HTML ellers).
declare(strict_types=1);
require __DIR__ . '/_private/bootstrap.php';

const MD_NEWSLETTER_CONSENT = 'Jeg accepterer at modtage nyhedsbrevet og kan altid afmelde mig.';

function md_nl_respond(int $status, bool $ok, string $message): void
{
    if (md_wants_json()) {
        md_json($status, ['ok' => $ok, 'message' => $message]);
    }
    if ($ok) {
        md_error_page($status, 'Tak!', $message, '/', 'Tilbage til forsiden');
    }
    md_error_page($status, 'Hov', $message, '/#nyhedsbrev', 'Prøv igen');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    md_redirect('/#nyhedsbrev');
}

$okMessage = 'Tak. Du er nu tilmeldt nyhedsbrevet.';

// Bots udfylder det skjulte felt; lad som om det lykkedes.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    md_nl_respond(200, true, $okMessage);
}

$email = mb_strtolower(trim((string) ($_POST['email'] ?? '')));
$name = mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 120);
$source = substr(preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($_POST['source'] ?? 'web'))) ?: 'web', 0, 60);

if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    md_nl_respond(422, false, 'Skriv en gyldig e-mailadresse.');
}
if (empty($_POST['consent'])) {
    md_nl_respond(422, false, 'Du skal acceptere at modtage nyhedsbrevet for at tilmelde dig.');
}

$stmt = md_db()->prepare(
    'INSERT INTO newsletter (email, name, source, consent, consent_at, ip_hash) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name), updated_at = CURRENT_TIMESTAMP'
);
$stmt->execute([$email, $name !== '' ? $name : null, $source, MD_NEWSLETTER_CONSENT, md_ip_hash()]);

md_nl_respond(200, true, $okMessage);
