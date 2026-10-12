# madslundnielsen.dk

Personal site for Mads Dahlén Lund-Nielsen: ESG courses, keynotes, board advisory and the
book "ESG er nemt". Static HTML with a small PHP + MySQL backend for the contact form and
newsletter sign-up. Built for plain shared hosting (simply.com), like fam-books.
No frameworks, no build step, no Composer.

## How it works

```
/  /kurser/  /bogen/  /priser/  /kontakt/   static pages (assets/css, assets/js)

/kontakt/ form ──▶ kontakt.php    ── saves to `inquiries`, mails mads@qlim8.com
                                     (From no-reply@madslundnielsen.dk, Reply-To the visitor)
newsletter     ──▶ nyhedsbrev.php ── saves to `newsletter` with consent text + timestamp
```

Both endpoints accept `fetch` (JSON reply) and plain POST without JS (303 redirect back).
`_private/bootstrap.php` creates the tables (`CREATE TABLE IF NOT EXISTS`) on first use,
so no phpMyAdmin import is needed. `database/schema.sql` holds the same definitions.

The price calculator on `/priser/` and the course tabs on `/kurser/` live in
`assets/js/main.js`. Prices are hours × 500 kr. per participant, excl. VAT.

## Files

| Path | What |
|---|---|
| `public_html/` | The webroot on simply.com |
| `public_html/*/index.html` | The five pages, plus `404.html` |
| `public_html/assets/` | CSS, JS, self-hosted Manrope font, images |
| `public_html/kontakt.php`, `nyhedsbrev.php` | Form endpoints |
| `public_html/_private/` | Config and shared PHP. Blocked from the web by `.htaccess` |
| `database/schema.sql` | MySQL tables `inquiries`, `newsletter` |
| `tests/` | Local end-to-end tests. Not uploaded |
| `.github/workflows/deploy.yml` | Deploy to simply.com |

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`:

1. `php -l` on all PHP files.
2. Writes `_private/config.php` from `config.sample.php` plus the repo secret `DB_PASSWORD`
   (the IP-hash salt is derived from it). `config.php` is never committed.
3. Uploads `public_html/` over FTPS to `ftp.simply.com` (user `madslundnielsen.dk`) with
   the repo secret `SIMPLY_FTP_PASSWORD`. Only changed files are sent; the sync state file
   is blocked from the web in `.htaccess`.

The database is `madslundnielsen_dk_db` on `mysql114.unoeuro.com`. You can also run the
workflow by hand from the Actions tab.

## Looking at the data (phpMyAdmin)

```sql
-- Inquiries, newest first
SELECT created_at, name, company, cvr, email, interest, participants, message, mail_sent
FROM inquiries ORDER BY created_at DESC;

-- Inquiries where the notification mail failed (follow up by hand)
SELECT created_at, name, email FROM inquiries WHERE mail_sent = 0;

-- Newsletter subscribers with consent
SELECT consent_at, name, email, source FROM newsletter ORDER BY consent_at;
```

## Before launch / TODO

- Book: format/pages and price are hidden on `/bogen/` and say "Pris på forespørgsel"
  on `/priser/` (HTML comments mark the spots).
- LinkedIn link on `/kontakt/` is left out until there is a URL.
- Privacy policy (Privatliv) for the contact form and newsletter, and a way to unsubscribe.
- Send a test inquiry on the live site and check it arrives at mads@qlim8.com.
- Add the site in Google Search Console and submit `https://madslundnielsen.dk/sitemap.xml`.

## Local testing

Requires PHP 8, MariaDB/MySQL and Playwright.

```sh
mysql -e "CREATE DATABASE mads_test; CREATE USER 'ml'@'127.0.0.1' IDENTIFIED BY 'mlpass';
          GRANT ALL ON mads_test.* TO 'ml'@'127.0.0.1';"
tests/run.sh
```
