<?php
// Kopiér denne fil til config.php (samme mappe) og udfyld adgangskoden.
// config.php må ALDRIG committes — den er i .gitignore.

return [
    // Den adresse siden ligger på, uden skråstreg til sidst.
    'site_url' => 'https://madslundnielsen.dk',

    // simply.com kontrolpanel → Databaser (MySQL). Tabellerne oprettes automatisk.
    'db' => [
        'host' => 'mysql114.unoeuro.com',
        'port' => 3306,
        'name' => 'madslundnielsen_dk_db',
        'user' => 'madslundnielsen_dk',
        'pass' => '', // udfyld
    ],

    // Henvendelser fra kontaktformularen sendes hertil (Reply-To er afsenderen).
    'notify_email' => 'mads@qlim8.com',

    // Afsenderadresse på notifikationsmails. Skal ligge på domænet (SPF).
    'mail_from' => 'no-reply@madslundnielsen.dk',

    'timezone' => 'Europe/Copenhagen',

    // Tilfældig tekst — bruges til at hashe IP-adresser (misbrugskontrol).
    'ip_salt' => 'REPLACE_WITH_A_LONG_RANDOM_STRING',

    // Sæt til true midlertidigt for at se fejl i browseren. Aldrig i drift.
    'debug' => false,
];
