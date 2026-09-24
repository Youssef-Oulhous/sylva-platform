-- ============================================================================
-- A4. SCHEMES AND UNIT TYPES  ·  what makes two volumes incomparable
-- ============================================================================
-- "There is no single standard, and different schemes measure different things."
-- A unit type belongs to exactly ONE scheme and never leaves it.

CREATE TABLE units.scheme (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         sylva.nonblank NOT NULL,
  registry_url text,
  source_label sylva.nonblank NOT NULL,   -- even the scheme name is a figure on screen
  as_of_date   date NOT NULL
);

CREATE TABLE units.unit_type (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id         uuid NOT NULL REFERENCES units.scheme(id),
  code              text NOT NULL,
  metric_label_en   sylva.nonblank NOT NULL,   -- 'hectares under restoration for a year'
  unit_of_measure   text NOT NULL REFERENCES platform.unit_of_measure(code),
  -- The note's two examples differ on what a period MEANS. Conflating them
  -- silently misdates every forward contract, which is most pilot deals.
  vintage_semantics text NOT NULL CHECK (vintage_semantics IN
      ('period_of_issuance','period_of_outcome','undefined_by_scheme')),
  definition_en     sylva.nonblank NOT NULL,
  source_label      sylva.nonblank NOT NULL,
  as_of_date        date NOT NULL,
  UNIQUE (scheme_id, code),
  -- composite-FK anchor: no downstream row can claim a unit type for a scheme
  -- that did not define it
  UNIQUE (id, scheme_id)
);

CREATE TABLE units.unit_type_translation (
  unit_type_id  uuid NOT NULL REFERENCES units.unit_type(id),
  locale        text NOT NULL REFERENCES i18n.locale(code),
  metric_label  sylva.nonblank NOT NULL,
  definition    sylva.nonblank NOT NULL,
  status        i18n.translation_status NOT NULL DEFAULT 'human_draft',
  source_locale text NOT NULL DEFAULT 'en' REFERENCES i18n.locale(code),
  source_sha256 sylva.sha256,     -- sha256 of the source text this was made from:
  updated_at    timestamptz NOT NULL DEFAULT now(),  -- turns a stale translation
  PRIMARY KEY (unit_type_id, locale),                -- into a flagged row, not a
  CHECK (source_locale <> locale)                    -- silently wrong one
);
