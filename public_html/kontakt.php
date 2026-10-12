<?php
// Kontaktformular: validerer, gemmer i MySQL og sender notifikationsmail til Mads.
// JSON til fetch, ellers 303-redirect tilbage til /kontakt/?sendt=1.
declare(strict_types=1);
require __DIR__ . '/_private/bootstrap.php';

const MD_INTERESTS = [
    'halv' => 'Halvdags ESG-grundkursus',
    'hel' => 'Heldags ESG-grundkursus Plus',
    'vsme' => 'Halvdags VSME-kursus',
    'keynote' => 'Keynote',
    'bestyrelse' => 'Bestyrelsessparring',
    'bog' => 'Bogen til hold',
    'andet' => 'Andet',
];

function md_contact_fail(string $message): void
{
    if (md_wants_json()) {
        md_json(422, ['ok' => false, 'message' => $message]);
    }
    md_error_page(422, 'Hov', $message, '/kontakt/', 'Tilbage til formularen');
}

function md_contact_ok(): void
{
    if (md_wants_json()) {
        md_json(200, ['ok' => true, 'message' => 'Tak for din henvendelse. Jeg vender tilbage hurtigst muligt.']);
    }
    md_redirect('/kontakt/?sendt=1#tak');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    md_redirect('/kontakt/');
}

// Bots udfylder det skjulte felt; lad som om det lykkedes.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    md_contact_ok();
}

$name = md_header_safe(mb_substr((string) ($_POST['name'] ?? ''), 0, 120));
$email = mb_strtolower(md_header_safe((string) ($_POST['email'] ?? '')));
$company = md_header_safe(mb_substr((string) ($_POST['company'] ?? ''), 0, 190));
$cvr = preg_replace('/\D/', '', (string) ($_POST['cvr'] ?? ''));
$interest = (string) ($_POST['interest'] ?? 'andet');
$participantsRaw = trim((string) ($_POST['participants'] ?? ''));
$message = trim(mb_substr((string) ($_POST['message'] ?? ''), 0, 5000));

if ($name === '') {
    md_contact_fail('Skriv dit navn.');
}
if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    md_contact_fail('Skriv en gyldig e-mailadresse.');
}
if ($cvr !== '' && strlen($cvr) !== 8) {
    md_contact_fail('CVR-nummeret skal være 8 cifre.');
}
if (!isset(MD_INTERESTS[$interest])) {
    $interest = 'andet';
}
$participants = null;
if ($participantsRaw !== '') {
    if (!ctype_digit($participantsRaw) || (int) $participantsRaw < 1 || (int) $participantsRaw > 1000) {
        md_contact_fail('Deltagerantal skal være et tal mellem 1 og 1000.');
    }
    $participants = (int) $participantsRaw;
}

$db = md_db();
$stmt = $db->prepare(
    'INSERT INTO inquiries (name, email, company, cvr, interest, participants, message, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $name, $email, $company !== '' ? $company : null, $cvr !== '' ? $cvr : null,
    $interest, $participants, $message !== '' ? $message : null, md_ip_hash(),
]);
$id = (int) $db->lastInsertId();

// Notifikationsmail. Fejl her må ikke miste henvendelsen — den ligger allerede i databasen.
$cfg = md_config();
$to = (string) ($cfg['notify_email'] ?? '');
if ($to !== '') {
    $from = md_header_safe((string) ($cfg['mail_from'] ?? 'no-reply@madslundnielsen.dk'));
    $lines = [
        'Ny forespørgsel fra madslundnielsen.dk',
        '',
        'Navn: ' . $name,
        'E-mail: ' . $email,
        'Virksomhed: ' . ($company !== '' ? $company : '-'),
        'CVR: ' . ($cvr !== '' ? $cvr : '-'),
        'Interesse: ' . MD_INTERESTS[$interest],
        'Deltagere: ' . ($participants !== null ? (string) $participants : '-'),
        '',
        'Bemærkninger:',
        $message !== '' ? $message : '-',
    ];
    $headers = [
        'From: madslundnielsen.dk <' . $from . '>',
        'Reply-To: ' . mb_encode_mimeheader($name, 'UTF-8') . ' <' . $email . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: madslundnielsen.dk',
    ];
    $subject = mb_encode_mimeheader('Ny forespørgsel: ' . MD_INTERESTS[$interest] . ' – ' . $name, 'UTF-8');
    $sent = @mail($to, $subject, implode("\r\n", $lines), implode("\r\n", $headers), '-f' . $from);
    if ($sent) {
        $db->prepare('UPDATE inquiries SET mail_sent = 1 WHERE id = ?')->execute([$id]);
    } else {
        error_log('madslundnielsen.dk: mail() fejlede for henvendelse #' . $id);
    }
}

md_contact_ok();
