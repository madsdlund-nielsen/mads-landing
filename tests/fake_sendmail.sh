#!/usr/bin/env bash
# Erstatter sendmail i testene: gemmer mailen i en fil, så e2e kan tjekke headers.
cat >> "${MD_MAIL_LOG:-/tmp/md-mail.log}"
printf '\n=====END=====\n' >> "${MD_MAIL_LOG:-/tmp/md-mail.log}"
