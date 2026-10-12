#!/usr/bin/env bash
# Lokal end-to-end test: MariaDB + PHP's indbyggede server + Playwright.
# Forudsætter lokal MariaDB/MySQL med databasen mads_test og brugeren ml/mlpass@127.0.0.1.
set -euo pipefail
cd "$(dirname "$0")/.."

export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
export MD_MAIL_LOG=/tmp/md-mail.log
mysql mads_test -e "DROP TABLE IF EXISTS inquiries, newsletter;"   # bootstrap.php opretter dem igen
rm -f "$MD_MAIL_LOG"

php -l public_html/kontakt.php >/dev/null
php -l public_html/nyhedsbrev.php >/dev/null
php -l public_html/_private/bootstrap.php >/dev/null

MD_CONFIG="$PWD/tests/config.test.php" php -d sendmail_path="$PWD/tests/fake_sendmail.sh" \
  -S 127.0.0.1:8090 -t public_html > /tmp/md-site.log 2>&1 & SITE=$!
trap 'kill $SITE 2>/dev/null || true' EXIT
sleep 1

node tests/e2e.js
