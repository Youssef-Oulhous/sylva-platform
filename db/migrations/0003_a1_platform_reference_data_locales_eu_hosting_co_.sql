-- ============================================================================
-- A1. PLATFORM REFERENCE DATA, LOCALES, EU HOSTING, CO-FUNDING NOTICE
-- ============================================================================

-- Section 9: "a named EU member state region such as Frankfurt, Paris or Dublin,
-- not a generic 'Europe' region, which may include London or Zurich."
-- That becomes a foreign key, not a deployment note.
CREATE TABLE platform.eu_member_state (
  code    sylva.country_code PRIMARY KEY,
  name_en sylva.nonblank NOT NULL
);
INSERT INTO platform.eu_member_state VALUES
 ('AT','Austria'),('BE','Belgium'),('BG','Bulgaria'),('HR','Croatia'),('CY','Cyprus'),
 ('CZ','Czechia'),('DK','Denmark'),('EE','Estonia'),('FI','Finland'),('FR','France'),
 ('DE','Germany'),('GR','Greece'),('HU','Hungary'),('IE','Ireland'),('IT','Italy'),
 ('LV','Latvia'),('LT','Lithuania'),('LU','Luxembourg'),('MT','Malta'),('NL','Netherlands'),
 ('PL','Poland'),('PT','Portugal'),('RO','Romania'),('SK','Slovakia'),('SI','Slovenia'),
 ('ES','Spain'),('SE','Sweden');

CREATE TABLE platform.storage_region (
  code         text PRIMARY KEY,
  provider     sylva.nonblank NOT NULL,
  city         sylva.nonblank NOT NULL,
  member_state sylva.country_code NOT NULL REFERENCES platform.eu_member_state(code)
);
COMMENT ON TABLE platform.storage_region IS
  'Object-storage and database regions. A region in London (GB) or Zurich (CH) cannot be inserted: those are not EU member states. Which provider and which region is an OPEN DECISION; seed it when the client answers.';

-- Locales. English first, German second (section 9).
CREATE TABLE i18n.locale (
  code       text PRIMARY KEY CHECK (code IN ('en','de')),
  label_en   sylva.nonblank NOT NULL,
  is_default boolean NOT NULL DEFAULT false
);
INSERT INTO i18n.locale VALUES ('en','English',true),('de','German',false);
CREATE UNIQUE INDEX ux_one_default_locale ON i18n.locale ((is_default)) WHERE is_default;

CREATE TYPE i18n.translation_status AS ENUM
  ('machine_draft','human_draft','reviewed','published');

-- Sector and size band appear on the PUBLIC record beside the pseudonym
-- (section 8). WHICH classification (NACE or a custom list) and WHAT the size
-- bands measure (employees, turnover, or both) is an OPEN DECISION; the shape
-- does not change with the answer.
CREATE TABLE platform.sector (
  code           text PRIMARY KEY,
  classification sylva.nonblank NOT NULL,   -- which taxonomy this code belongs to
  label_en       sylva.nonblank NOT NULL,
  label_de       text
);

CREATE TABLE platform.size_band (
  code     text PRIMARY KEY,
  basis    sylva.nonblank NOT NULL,         -- employees / turnover / both
  label_en sylva.nonblank NOT NULL,
  label_de text
);

CREATE TABLE platform.unit_of_measure (
  code       text PRIMARY KEY,             -- 'ha_yr', 'index_point'
  label_en   sylva.nonblank NOT NULL,
  definition sylva.nonblank NOT NULL,
  decimals   smallint NOT NULL CHECK (decimals BETWEEN 0 AND 6),
  source_label sylva.nonblank NOT NULL,
  as_of_date date NOT NULL
);

-- Section 2 and 9: every page carries the EU emblem, the co-funding line and a
-- short disclaimer. Versioned, per locale, so every page renders one approved
-- text from one place. THE EXACT WORDING AND THE EMBLEM ASSET MUST COME FROM THE
-- FUNDER - nothing is drafted here.
CREATE TABLE platform.site_notice (
  code          text NOT NULL CHECK (code IN ('eu_emblem_alt','co_funding_line','disclaimer')),
  locale        text NOT NULL REFERENCES i18n.locale(code),
  version_no    int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  body          sylva.nonblank NOT NULL,
  source_ref_id uuid NOT NULL REFERENCES sylva.source_ref(id),
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, locale, version_no),
  -- trigger-free contiguous versioning: v(n) must point at v(n-1)
  FOREIGN KEY (code, locale, prev_version_no)
    REFERENCES platform.site_notice (code, locale, version_no)
);

-- Self-hosted / EU-hosted analytics, aggregate only. No IP address, no session
-- id, no user id, nothing that can be re-joined to a person: that absence IS
-- the privacy design, not an omission.
CREATE TABLE platform.page_view_daily (
  day           date NOT NULL,
  path_key      text NOT NULL,
  locale        text NOT NULL REFERENCES i18n.locale(code),
  project_id    uuid,                -- FK added after proj.project
  view_count    bigint NOT NULL CHECK (view_count > 0),
  PRIMARY KEY (day, path_key, locale)
);
