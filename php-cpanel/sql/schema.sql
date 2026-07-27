-- PontiScore — esquema MySQL
-- Importe este ficheiro em phpMyAdmin (cPanel) ou execute os comandos abaixo.
-- Compatível com MySQL 5.7+/MariaDB 10.2+ (usa LONGTEXT para os campos JSON).

CREATE TABLE IF NOT EXISTS diagnostics (
    id              CHAR(36)     NOT NULL PRIMARY KEY,
    total_score     INT          NOT NULL,
    tier            VARCHAR(120) NOT NULL,
    pillar_scores   LONGTEXT     NOT NULL,   -- JSON
    strengths       LONGTEXT     NOT NULL,   -- JSON
    weaknesses      LONGTEXT     NOT NULL,   -- JSON
    recommendations LONGTEXT     NOT NULL,   -- JSON
    answers         LONGTEXT     NOT NULL,   -- JSON
    created_at      DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
    id                 CHAR(36)     NOT NULL PRIMARY KEY,
    name               VARCHAR(160) NOT NULL,
    company            VARCHAR(160) NOT NULL,
    email              VARCHAR(190) NOT NULL,
    phone              VARCHAR(40)  NULL,
    diagnostic_id      CHAR(36)     NOT NULL,
    privacy_accepted   TINYINT(1)   NOT NULL DEFAULT 0,
    marketing_accepted TINYINT(1)   NOT NULL DEFAULT 0,
    consent_at         DATETIME     NOT NULL,
    email_sent         TINYINT(1)   NOT NULL DEFAULT 0,
    created_at         DATETIME     NOT NULL,
    INDEX idx_leads_diagnostic (diagnostic_id),
    INDEX idx_leads_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
