-- madslundnielsen.dk — MySQL/MariaDB schema.
-- NB: public_html/_private/bootstrap.php opretter de samme tabeller automatisk
-- (CREATE TABLE IF NOT EXISTS) første gang databasen bruges, så et manuelt import er ikke nødvendigt.
-- Hold de to ens. Manuelt import: phpMyAdmin → Import, eller
--   mysql -h <host> -u <user> -p <database> < schema.sql

SET NAMES utf8mb4;

-- Forespørgsler fra kontaktformularen (/kontakt.php).
CREATE TABLE IF NOT EXISTS inquiries (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  company       VARCHAR(190) NULL,
  cvr           VARCHAR(8) NULL,
  interest      VARCHAR(40) NOT NULL COMMENT 'halv, hel, vsme, keynote, bestyrelse, bog, andet',
  participants  INT UNSIGNED NULL,
  message       TEXT NULL,
  ip_hash       CHAR(64) NULL COMMENT 'SHA-256 af IP + hemmeligt salt, kun til misbrugskontrol',
  mail_sent     TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = notifikationsmail afleveret til mail()',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inquiries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nyhedsbrev-tilmeldinger (/nyhedsbrev.php).
CREATE TABLE IF NOT EXISTS newsletter (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email       VARCHAR(190) NOT NULL,
  name        VARCHAR(120) NULL,
  source      VARCHAR(60) NULL,
  consent     VARCHAR(255) NOT NULL COMMENT 'Samtykketeksten, som den stod ved tilmelding',
  consent_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',
  ip_hash     CHAR(64) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_newsletter_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nyttige forespørgsler til phpMyAdmin:
--   Forespørgsler:   SELECT created_at, name, email, company, interest, participants FROM inquiries ORDER BY created_at DESC;
--   Nyhedsbrev:      SELECT consent_at, name, email, source FROM newsletter ORDER BY consent_at;
