-- ============================================================================
-- D2. "STATED BY THE PROJECT OWNER" IS A KIND OF SOURCE
-- ============================================================================
-- sylva.source_kind had four values: document, external_publication,
-- operator_statement, calculated_by_sylva. Until migration 0050 that was
-- complete, because only Sylva could write project content, so an unsourced
-- figure entered by hand was by definition an operator statement.
--
-- An owner writing its own project can now record a figure whose only
-- provenance is that the owner states it. Filing that as 'operator_statement'
-- would say on the published page that Sylva asserted it. That is a false
-- provenance, and false provenance is worse than none: the whole point of
-- source_ref_id being NOT NULL is that a reader can tell where a number came
-- from and decide what it is worth.
--
-- One new value, additive. Nothing is renamed and nothing is removed, so every
-- existing row, CHECK and trigger is untouched. The value is added and not used
-- in this migration, which is what PostgreSQL requires of an enum extension
-- inside a transaction (db/apply.sh runs each file with -1).
-- ============================================================================

ALTER TYPE sylva.source_kind ADD VALUE IF NOT EXISTS 'project_owner_statement';

COMMENT ON TYPE sylva.source_kind IS
  'Where a displayed figure came from. document = a version of an uploaded '
  'file, with a locator into it. external_publication = a named third-party '
  'dataset or report. operator_statement = Sylva asserts it. '
  'project_owner_statement = the project owner asserts it, and the page says '
  'so rather than attributing it to Sylva. calculated_by_sylva = computed '
  'here, with the definition in the label and the computation date.';
