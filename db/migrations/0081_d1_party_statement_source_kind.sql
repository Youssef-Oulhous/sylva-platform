-- ============================================================================
-- D1b. A PROVENANCE KIND FOR "THE PARTY SAID SO"
-- ============================================================================
-- Migration range 0080-0084 (buyer-sites-and-dashboard).
--
-- sylva.source_kind has had four values since migration 0002:
--
--   document              a figure taken from a lodged document version
--   external_publication  a figure taken from someone else's publication
--   operator_statement    Sylva asserts it
--   calculated_by_sylva   Sylva computed it, and the label says how
--
-- A buyer registering the coordinates of its own plant is none of those. It is
-- the party's own assertion about itself, and the platform neither holds a
-- document for it, nor published it, nor computed it, nor - and this is the
-- one that matters - asserted it. Recording it as 'operator_statement' would
-- put Sylva's name on a figure Sylva has never seen, in the one column an
-- auditor filters on when asking who stood behind a number.
--
-- The same kind is what a project owner's self-reported figures want, so the
-- value is named for the general case rather than for buyer sites.
--
-- ALTER TYPE ... ADD VALUE is allowed inside a transaction block on PostgreSQL
-- 12 and later; the new value may not be USED until that transaction commits,
-- which is why nothing below writes one. db/apply.sh runs each migration with
-- -1, so this file is that transaction.
--
-- Rules touched: none. Adding a value widens no grant, no policy and no read.
-- ============================================================================

ALTER TYPE sylva.source_kind ADD VALUE IF NOT EXISTS 'party_statement';

COMMENT ON TYPE sylva.source_kind IS
  'Who stands behind a displayed figure. party_statement means the '
  'organisation the figure is about asserted it - a buyer''s own site '
  'coordinate, an owner''s own self-reported fact. It is deliberately NOT '
  'operator_statement: Sylva has not seen it and must not appear to vouch for '
  'it.';
