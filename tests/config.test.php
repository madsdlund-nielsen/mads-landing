<?php
// Bruges af tests/run.sh (lokal MariaDB).
return [
    'site_url' => 'http://127.0.0.1:8090',
    'db' => ['host' => '127.0.0.1', 'port' => 3306, 'name' => 'mads_test', 'user' => 'ml', 'pass' => 'mlpass'],
    'notify_email' => 'mads@qlim8.com',
    'mail_from' => 'no-reply@madslundnielsen.dk',
    'timezone' => 'Europe/Copenhagen',
    'ip_salt' => 'test-salt',
    'debug' => true,
];
