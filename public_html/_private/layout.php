<?php
// Fælles sidehoved/-fod til PHP-svar uden JS (samme udseende som de statiske sider).
declare(strict_types=1);

function md_page_start(string $title): void
{
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex');
        header('Referrer-Policy: same-origin');
    }
    $t = h($title);
    echo <<<HTML
<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{$t} | Mads Dahlén Lund-Nielsen</title>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<header class="site-header">
  <div class="site-header__inner">
    <a href="/" class="brand" aria-label="Mads Dahlén Lund-Nielsen – forside">
      <span class="brand__name">Mads Dahlén Lund-Nielsen</span>
      <span class="brand__tag">Civilingeniør · ESG · Klimaregnskab</span>
    </a>
  </div>
</header>
<main>

HTML;
}

function md_page_end(): void
{
    echo <<<HTML

</main>
<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__bot"><span>© 2026 Mads Dahlén Lund-Nielsen</span><span>esgernemt.dk · qlim8.com</span></div>
  </div>
</footer>
</body>
</html>

HTML;
}
