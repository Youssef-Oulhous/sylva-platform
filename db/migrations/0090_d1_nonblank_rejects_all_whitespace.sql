-- ============================================================================
-- D1. nonblank MUST REFUSE EVERY KIND OF BLANK, NOT JUST THE ASCII SPACE
--
-- Found by the user simulation, 25 September 2026, attacking rule 2.
--
-- sylva.nonblank was CHECK (btrim(VALUE) <> ''). btrim/1 strips the ASCII
-- space and nothing else, so of seven ways of writing "nothing" only one was
-- refused. A tab, a newline, a no-break space (U+00A0), a zero-width space
-- (U+200B), an en space, an ideographic space and a BOM all passed, and the
-- simulation drove a complete issue -> allocate -> retire chain against a
-- registry reference consisting of a tab and a newline.
--
-- That is rule 2 broken: "No credit can be allocated, transferred or retired
-- without a reference to the scheme's registry record." A reference nobody can
-- see is not a reference, and the whole point of putting the rule in the
-- database was that it holds whatever any screen does.
--
-- This is not only about registry references. sylva.nonblank is the domain
-- behind a project's title, a claim right's exclusions, a vetting decision's
-- reason and about ninety other columns. Every one of them could be set to
-- invisible whitespace, and would then render as an empty space on a page that
-- claims to state something.
--
-- The new check requires at least one character that is not whitespace,
-- covering the Unicode space separators, the line and paragraph separators,
-- the zero-width characters and the byte order mark. Leading and trailing
-- whitespace around real text stays legal - "  Havel  " is a formatting
-- question, not an emptiness one.
-- ============================================================================

-- Nothing already stored may violate the stricter rule. If this raises, stop:
-- something invisible is already in the data and must be corrected first.
DO $$
DECLARE offending int := 0; r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, a.attname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE a.atttypid = 'sylva.nonblank'::regtype
       AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I IS NOT NULL AND %I !~ %L',
      r.nspname, r.relname, r.attname, r.attname,
      '[^[:space:]   -‍    ⁠　﻿]')
    INTO STRICT offending;
    IF offending > 0 THEN
      RAISE EXCEPTION 'existing data violates the stricter nonblank: %.%.% has % blank value(s)',
        r.nspname, r.relname, r.attname, offending;
    END IF;
  END LOOP;
  RAISE NOTICE 'no stored value violates the stricter nonblank';
END $$;

ALTER DOMAIN sylva.nonblank DROP CONSTRAINT nonblank_check;

ALTER DOMAIN sylva.nonblank ADD CONSTRAINT nonblank_check
  CHECK (VALUE ~ '[^[:space:]   -‍    ⁠　﻿]');

COMMENT ON DOMAIN sylva.nonblank IS
  'Text that actually says something. Requires at least one character that is '
  'not whitespace - including the Unicode space separators, the line and '
  'paragraph separators, the zero-width characters and the BOM, none of which '
  'btrim() removes. Surrounding whitespace around real text is still allowed.';

-- ---------------------------------------------------------------------------
-- The guard, with a self-test. A check that cannot fail is not a check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ci.assert_nonblank_refuses_blanks() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  blanks text[] := ARRAY[
    ' ', '   ', E'\t', E'\n', E'\r', E'\t\n',
    E' ', E' ', E' ', E' ', E'​', E'‌',
    E'‍', E' ', E' ', E' ', E' ', E'⁠',
    E'　', E'﻿', E'​\t \n'
  ];
  v text;
  accepted text[] := '{}';
BEGIN
  FOREACH v IN ARRAY blanks LOOP
    BEGIN
      PERFORM v::sylva.nonblank;
      accepted := accepted || quote_literal(v);       -- it should have raised
    EXCEPTION WHEN check_violation THEN
      NULL;                                            -- refused, as intended
    END;
  END LOOP;

  IF array_length(accepted, 1) > 0 THEN
    PERFORM ci.fail('nonblank_refuses_blanks',
      'these blank values were accepted: ' || array_to_string(accepted, ', '));
  END IF;

  -- and it must still accept real text, including text with spaces around it
  BEGIN
    PERFORM 'Havel'::sylva.nonblank;
    PERFORM '  Lower Havel catchment  '::sylva.nonblank;
    PERFORM 'a'::sylva.nonblank;
  EXCEPTION WHEN check_violation THEN
    PERFORM ci.fail('nonblank_refuses_blanks', 'the domain now refuses real text');
  END;
END $$;

COMMENT ON FUNCTION ci.assert_nonblank_refuses_blanks() IS
  'R2 and about ninety other columns. Tries 21 ways of writing nothing and '
  'requires every one to be refused, then requires real text to still pass.';

SELECT ci.assert_nonblank_refuses_blanks();
