import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { formatQty } from '@/lib/units/qty';
import {
  addClaimRightAction, addDurabilityAction, addOutcomeAction, addPartyAction,
  addPeriodAction, declareUnitTypeAction, saveBoundaryAction, saveProjectTextAction,
  submitForReviewAction,
} from '@/lib/owner/actions';
import { ownerText } from '@/lib/owner/messages';
import { getActor } from '@/lib/auth/session';
import ProjectDocumentsPanel from '@/components/documents/ProjectDocumentsPanel';
import { bodyOf, type OwnerProjectRecord, type OwnerReference } from '@/lib/owner/types';
import FormSection from './FormSection';
import { FieldRow, Note, SelectField, StaticValue, TextField } from './Fields';
import SourceFields from './SourceFields';
import RecordedEntries from './RecordedEntries';
import styles from './RecordForm.module.css';

/**
 * The record, section by section, in the order a buyer reads it.
 *
 * Each section is its OWN form posting its own Server Action. That is not a
 * layout choice: project content is append-only and versioned, so recording an
 * outcome and recording a boundary are two entries with two sources and two
 * dates, and one giant submit would collapse them into a single undifferentiated
 * save. It also means a refusal in one section - an invalid polygon, an
 * overlapping period - does not discard what was typed into the others.
 *
 * Every section carries its provenance block, and the note under each submit
 * says what saving does: a new version, with the previous one still on the
 * record. That is Rule 4 stated where it is acted on rather than in a help page.
 *
 * RULE 7. The only volumes on this page are in the period section, they belong
 * to one project and one unit type by composite foreign key, and the unit label
 * is printed beside every one of them. There is no total anywhere - not across
 * projects, and not across this project's own periods.
 */

interface SectionProps {
  record: OwnerProjectRecord;
  reference: OwnerReference;
  locale: string;
}

/** Today, as the default as-of date. A source without a date is half a fact. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function SubmitButton({ label }: { label: string }) {
  const t = await getTranslations();
  return (
    <div className={styles.actions}>
      <button type="submit" className={styles.submit}>{label}</button>
      <p className={styles.note}>{ownerText(t, 'appendNote')}</p>
    </div>
  );
}

/* ------------------------------------------------------ 01  IDENTITY + TEXT */

export async function TextSection({ record, locale }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'text';

  const statusOptions = [
    { value: 'human_draft', label: ownerText(t, 'statusHumanDraft') },
    { value: 'machine_draft', label: ownerText(t, 'statusMachineDraft') },
    { value: 'reviewed', label: ownerText(t, 'statusReviewed') },
    { value: 'published', label: ownerText(t, 'statusPublished') },
  ];

  const statusOf = (fieldCode: string, loc: string) =>
    record.text.find((x) => x.fieldCode === fieldCode && x.locale === loc)?.status
    ?? 'human_draft';

  return (
    <FormSection
      id="record-text"
      n={1}
      title={tf('section.summary.title')}
      lead={tf('section.summary.lead')}
    >
      <form className={styles.form} action={saveProjectTextAction}>
        <input type="hidden" name="slug" value={record.slug} />

        <FieldRow>
          <TextField
            id={`${prefix}-title-en`} name="title_en"
            label={tf('field.nameEn')} hint={tf('field.nameEnHint')}
            defaultValue={bodyOf(record.text, 'title', 'en')} required
          />
          <TextField
            id={`${prefix}-title-de`} name="title_de"
            label={tf('field.nameDe')} hint={tf('field.nameDeHint')}
            defaultValue={bodyOf(record.text, 'title', 'de')} optional
          />
        </FieldRow>

        <FieldRow>
          <TextField
            id={`${prefix}-summary-en`} name="summary_en"
            label={tf('field.summaryBodyEn')} hint={tf('field.summaryBodyHint')}
            defaultValue={bodyOf(record.text, 'summary', 'en')} rows={10} required
          />
          <TextField
            id={`${prefix}-summary-de`} name="summary_de"
            label={tf('field.summaryBodyDe')} hint={tf('field.summaryBodyHint')}
            defaultValue={bodyOf(record.text, 'summary', 'de')} rows={10} optional
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-catchment`} name="catchment_context_en"
            label={t('project.catchment')} hint={tf('field.catchmentHint')}
            defaultValue={bodyOf(record.text, 'catchment_context', 'en')}
            rows={5} optional
          />
        </FieldRow>

        <FieldRow>
          <TextField
            id={`${prefix}-partners-note`} name="partners_note_en"
            label={t('project.partners')} hint={tf('field.partnerNoteHint')}
            defaultValue={bodyOf(record.text, 'partners_note', 'en')}
            rows={4} optional
          />
          <TextField
            id={`${prefix}-durability-note`} name="durability_note_en"
            label={t('project.durability')} hint={tf('field.landControlHint')}
            defaultValue={bodyOf(record.text, 'durability_note', 'en')}
            rows={4} optional
          />
        </FieldRow>

        <FieldRow>
          <SelectField
            id={`${prefix}-status-en`} name="status_en"
            label={`${ownerText(t, 'translationStatus')} (EN)`}
            hint={ownerText(t, 'translationStatusHint')}
            defaultValue={statusOf('title', 'en')}
            options={statusOptions} required
          />
          <SelectField
            id={`${prefix}-status-de`} name="status_de"
            label={`${ownerText(t, 'translationStatus')} (DE)`}
            defaultValue={statusOf('title', 'de')}
            options={statusOptions} required
          />
        </FieldRow>

        <Note tone="rule">{tf('field.summaryFallback')}</Note>

        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>

      {/* The versions already on the record, so an owner can see what a save
          will be added to. Locale is shown because a German version and an
          English one are different rows, not different renderings of one. */}
      <div className={styles.recorded}>
        <p className={styles.recordedTitle}>{ownerText(t, 'alreadyRecorded')}</p>
        {record.text.length === 0 ? (
          <p className={styles.empty}>{ownerText(t, 'nothingRecorded')}</p>
        ) : (
          <ul className={styles.list}>
            {record.text.map((x) => (
              <li key={`${x.fieldCode}-${x.locale}`} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemLabel}>
                    {x.fieldCode} ({x.locale.toUpperCase()})
                  </span>
                  <span className={styles.itemVersion}>
                    {ownerText(t, 'entryVersion')} {x.versionNo}{' '}
                    {t('source.separator')} {x.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className={styles.note} lang={locale}>{tf('field.unitRule')}</p>
    </FormSection>
  );
}

/* --------------------------------------------------- 02  SCHEME + UNIT TYPE */

export async function UnitTypeSection({ record, reference }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'unit';

  // A project keeps the unit type it was declared under: proj.project_unit_type
  // is the composite-FK spine every volume hangs off, so changing it would
  // orphan every figure already recorded.
  if (record.unitTypeId !== null) {
    return (
      <FormSection
        id="record-unit" n={2}
        title={ownerText(t, 'unitSectionTitle')}
        lead={ownerText(t, 'unitSectionLead')}
      >
        <FieldRow>
          <StaticValue label={t('project.scheme')} value={record.schemeName ?? ''} />
          <StaticValue label={t('project.unitType')} value={record.unitLabel ?? ''} />
        </FieldRow>
        <Note tone="rule">{ownerText(t, 'unitAlreadySet')}</Note>
      </FormSection>
    );
  }

  return (
    <FormSection
      id="record-unit" n={2}
      title={ownerText(t, 'unitSectionTitle')}
      lead={ownerText(t, 'unitSectionLead')}
    >
      <form className={styles.form} action={declareUnitTypeAction}>
        <input type="hidden" name="slug" value={record.slug} />
        <FieldRow cols={1}>
          <SelectField
            id={`${prefix}-unit-type`} name="unit_type"
            label={ownerText(t, 'unitTypeField')}
            hint={tf('field.unitHint')}
            placeholderOption={ownerText(t, 'notStated')}
            options={reference.unitTypes.map((u) => ({
              value: u.id,
              // The scheme is part of the label: two schemes can both call a
              // unit "points", and they are not the same points.
              label: `${u.label} — ${u.code} (${u.unitOfMeasure})`,
            }))}
            required
          />
        </FieldRow>
        <Note tone="rule">{tf('field.unitRule')}</Note>
        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>
    </FormSection>
  );
}

/* --------------------------------------------------------------- 03  PLACE */

export async function BoundarySection({ record }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'geo';

  return (
    <FormSection
      id="record-boundary" n={3}
      title={ownerText(t, 'boundaryTitle')}
      lead={ownerText(t, 'boundaryLead')}
    >
      <form className={styles.form} action={saveBoundaryAction}>
        <input type="hidden" name="slug" value={record.slug} />

        <FieldRow>
          <SelectField
            id={`${prefix}-kind`} name="kind"
            label={ownerText(t, 'geometryKind')}
            defaultValue="boundary"
            options={[
              { value: 'boundary', label: ownerText(t, 'geometryBoundary') },
              { value: 'catchment', label: ownerText(t, 'geometryCatchment') },
            ]}
            required
          />
          <TextField
            id={`${prefix}-as-of`} name="geometry_as_of" type="date"
            label={tf('provenance.asOf')} defaultValue={today()} mono required
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-geojson`} name="geojson"
            label={ownerText(t, 'geojsonField')}
            hint={ownerText(t, 'geojsonHint')}
            rows={8} required
          />
        </FieldRow>

        <FieldRow>
          <TextField
            id={`${prefix}-licence`} name="source_licence"
            label={ownerText(t, 'licenceField')}
            hint={ownerText(t, 'licenceHint')}
            required
          />
          <TextField
            id={`${prefix}-dataset`} name="dataset_name"
            label={ownerText(t, 'datasetField')}
            hint={ownerText(t, 'datasetHint')}
            optional
          />
        </FieldRow>

        <Note tone="rule">{tf('field.geometryNote')}</Note>

        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>

      <div className={styles.recorded}>
        <p className={styles.recordedTitle}>{ownerText(t, 'alreadyRecorded')}</p>
        <p className={styles.empty}>
          {ownerText(t, 'boundaryVersions')}: {record.boundaryVersions}
        </p>
      </div>
    </FormSection>
  );
}

/* -------------------------------------------------------- 04  CLAIM RIGHTS */

export async function ClaimRightsSection({ record }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'claim';

  return (
    <FormSection
      id="record-claims" n={4}
      title={t('project.claimRights')}
      lead={tf('section.claims.lead')}
    >
      <RecordedEntries entries={record.claimRights} />

      <form className={styles.form} action={addClaimRightAction}>
        <input type="hidden" name="slug" value={record.slug} />

        <FieldRow>
          <TextField
            id={`${prefix}-key`} name="benefit_key"
            label={ownerText(t, 'entryKeyField')}
            hint={ownerText(t, 'entryKeyHint')}
            mono required
          />
          <SelectField
            id={`${prefix}-locale`} name="locale"
            label={ownerText(t, 'contentLocale')}
            defaultValue="en"
            options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]}
            required
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-label`} name="benefit_label"
            label={t('project.benefit')} hint={tf('field.benefitHint')} required
          />
        </FieldRow>

        <FieldRow>
          <TextField
            id={`${prefix}-who`} name="who_may_claim"
            label={t('project.claimHolder')} hint={tf('field.holderHint')}
            rows={4} required
          />
          <TextField
            id={`${prefix}-for`} name="for_what"
            label={t('project.allowedUse')} hint={tf('field.allowedHint')}
            rows={4} required
          />
        </FieldRow>

        {/* NOT NULL and non-blank in the schema. A blank exclusions field is the
            failure the interviewed buyers described, so it is required here and
            the database would refuse it empty in any case. */}
        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-excl`} name="exclusions"
            label={t('project.exclusions')} hint={tf('field.excludedHint')}
            rows={4} required
          />
        </FieldRow>

        <Note tone="rule">{tf('field.claimsRule')}</Note>

        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>
    </FormSection>
  );
}

/* ------------------------------------------------------------- 05 OUTCOMES */

export async function OutcomesSection({ record, reference }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'outcome';

  return (
    <FormSection
      id="record-outcomes" n={5}
      title={t('project.outcomes')}
      lead={tf('section.outcomes.lead')}
    >
      <RecordedEntries entries={record.outcomes} />

      <form className={styles.form} action={addOutcomeAction}>
        <input type="hidden" name="slug" value={record.slug} />

        <FieldRow cols={3}>
          <TextField
            id={`${prefix}-code`} name="indicator_code"
            label={ownerText(t, 'entryKeyField')}
            hint={ownerText(t, 'entryKeyHint')}
            mono required
          />
          <SelectField
            id={`${prefix}-domain`} name="domain"
            label={tf('field.outcomeDomain')} hint={tf('field.outcomeDomainHint')}
            options={[
              { value: 'water', label: t('project.water') },
              { value: 'biodiversity', label: t('project.biodiversity') },
            ]}
            required
          />
          <SelectField
            id={`${prefix}-locale`} name="locale"
            label={ownerText(t, 'contentLocale')}
            defaultValue="en"
            options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]}
            required
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-what`} name="what_is_measured"
            label={t('project.metric')} hint={tf('field.metricHint')}
            rows={3} required
          />
        </FieldRow>

        <FieldRow cols={3}>
          <TextField
            id={`${prefix}-unit`} name="measure_unit"
            label={ownerText(t, 'measureUnitField')}
            hint={ownerText(t, 'measureUnitHint')}
            required
          />
          <TextField
            id={`${prefix}-baseline`} name="baseline_value"
            label={t('project.baseline')} hint={tf('field.baselineHint')}
            mono optional
          />
          <TextField
            id={`${prefix}-baseline-as-of`} name="baseline_as_of" type="date"
            label={ownerText(t, 'baselineAsOfField')} mono optional
          />
        </FieldRow>

        <FieldRow>
          <SelectField
            id={`${prefix}-verifier`} name="verifier_org"
            label={t('project.verifier')} hint={tf('field.verifierHint')}
            placeholderOption={ownerText(t, 'notStated')}
            options={reference.nameableOrgs.map((o) => ({ value: o.id, label: o.name }))}
            optional
          />
          <TextField
            id={`${prefix}-uncertainty`} name="uncertainty_note"
            label={t('project.uncertainty')} hint={tf('field.uncertaintyHint')}
            rows={3} optional
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-method`} name="method_note"
            label={t('project.method')} hint={tf('field.methodHint')}
            rows={4} optional
          />
        </FieldRow>

        <Note tone="rule">{tf('field.outcomesRule')}</Note>

        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>
    </FormSection>
  );
}

/* ----------------------------------------------------------- 06 DURABILITY */

export async function DurabilitySection({ record, reference }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'dur';

  return (
    <FormSection
      id="record-durability" n={6}
      title={t('project.durability')}
      lead={tf('section.durability.lead')}
    >
      <RecordedEntries entries={record.durability} />

      <form className={styles.form} action={addDurabilityAction}>
        <input type="hidden" name="slug" value={record.slug} />

        <FieldRow>
          <TextField
            id={`${prefix}-key`} name="commitment_key"
            label={ownerText(t, 'entryKeyField')}
            hint={ownerText(t, 'entryKeyHint')}
            mono required
          />
          <SelectField
            id={`${prefix}-locale`} name="locale"
            label={ownerText(t, 'contentLocale')}
            defaultValue="en"
            options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]}
            required
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-statement`} name="statement"
            label={ownerText(t, 'statementField')} hint={tf('field.afterContractHint')}
            rows={4} required
          />
        </FieldRow>

        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-land`} name="land_control_note"
            label={t('project.landControl')} hint={tf('field.landControlHint')}
            rows={4} required
          />
        </FieldRow>

        {/* The schema requires an end date or a horizon: a commitment with
            neither does not say how long it lasts. */}
        <FieldRow cols={3}>
          <TextField
            id={`${prefix}-starts`} name="starts_on" type="date"
            label={ownerText(t, 'startsOnField')} mono optional
          />
          <TextField
            id={`${prefix}-ends`} name="ends_on" type="date"
            label={ownerText(t, 'endsOnField')} mono optional
          />
          <TextField
            id={`${prefix}-horizon`} name="horizon_years"
            label={ownerText(t, 'horizonField')} hint={tf('field.commitmentLengthHint')}
            mono optional
          />
        </FieldRow>

        <FieldRow cols={1}>
          <SelectField
            id={`${prefix}-responsible`} name="responsible_org"
            label={ownerText(t, 'responsibleField')} hint={tf('field.maintenanceHint')}
            placeholderOption={ownerText(t, 'notStated')}
            options={reference.nameableOrgs.map((o) => ({ value: o.id, label: o.name }))}
            optional
          />
        </FieldRow>

        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>
    </FormSection>
  );
}

/* ------------------------------------------------------------- 07 PARTNERS */

export async function PartnersSection({ record, reference }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'party';

  return (
    <FormSection
      id="record-partners" n={7}
      title={t('project.partners')}
      lead={tf('section.partners.lead')}
    >
      <RecordedEntries entries={record.parties} />

      <form className={styles.form} action={addPartyAction}>
        <input type="hidden" name="slug" value={record.slug} />

        <FieldRow>
          <SelectField
            id={`${prefix}-org`} name="party_org"
            label={ownerText(t, 'partyOrgField')}
            hint={ownerText(t, 'partyOrgHint')}
            placeholderOption={ownerText(t, 'notStated')}
            options={reference.nameableOrgs.map((o) => ({ value: o.id, label: o.name }))}
            required
          />
          <SelectField
            id={`${prefix}-role`} name="party_role"
            label={ownerText(t, 'partyRoleField')}
            options={reference.partyRoles.map((r) => ({ value: r.code, label: r.labelEn }))}
            required
          />
        </FieldRow>

        {/* Where a landowner is a natural person the page carries a
            non-identifying description and the name stays out of the database
            entirely. That is why this field exists and a "name" field does not. */}
        <FieldRow cols={1}>
          <TextField
            id={`${prefix}-desc`} name="description_en"
            label={ownerText(t, 'partyDescriptionField')}
            hint={tf('field.partnerNoteHint')}
            rows={3} optional
          />
        </FieldRow>

        <SourceFields prefix={prefix} defaultAsOf={today()} />
        <SubmitButton label={ownerText(t, 'recordThis')} />
      </form>
    </FormSection>
  );
}

/* -------------------------------------------------------------- 08 PERIODS */

export async function PeriodsSection({ record, locale }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const prefix = 'period';

  return (
    <FormSection
      id="record-periods" n={8}
      title={t('project.availability')}
      lead={tf('section.periods.lead')}
    >
      {/* One table per period, each in its own unit. There is no total row and
          no total column: Rule 7 forbids adding across projects, and adding
          across this project's own periods would still be a figure nobody
          asked for. */}
      <div className={styles.recorded}>
        <p className={styles.recordedTitle}>{ownerText(t, 'periodsRecorded')}</p>
        {record.periods.length === 0 ? (
          <p className={styles.empty}>{ownerText(t, 'nothingRecorded')}</p>
        ) : (
          <ul className={styles.list}>
            {record.periods.map((p) => (
              <li key={p.periodId} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemLabel}>{p.periodLabel}</span>
                  <span className={styles.itemVersion}>
                    {p.startsOn} → {p.endsOn}
                  </span>
                </div>
                <p className={styles.itemDetail}>
                  {t('project.expectedIssuance')}:{' '}
                  {formatQty(p.expected, p.unitLabel, locale)} {t('source.separator')}{' '}
                  {t('project.buffer')}: {formatQty(p.buffer, p.unitLabel, locale)}{' '}
                  {t('source.separator')} {t('project.committed')}:{' '}
                  {formatQty(p.committed, p.unitLabel, locale)} {t('source.separator')}{' '}
                  {t('project.remaining')}:{' '}
                  {formatQty(p.remaining, p.unitLabel, locale)}
                </p>
                <SourceStamp
                  source={{
                    label: p.source.label,
                    locator: p.source.locator,
                    asOfDate: p.source.asOfDate,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {record.unitTypeId === null ? (
        <Note tone="rule">{ownerText(t, 'needsUnitTypeFirst')}</Note>
      ) : (
        <form className={styles.form} action={addPeriodAction}>
          <input type="hidden" name="slug" value={record.slug} />
          <input type="hidden" name="unit_type" value={record.unitTypeId} />

          <FieldRow cols={3}>
            <TextField
              id={`${prefix}-label`} name="period_label"
              label={ownerText(t, 'periodLabelField')}
              hint={ownerText(t, 'periodLabelHint')}
              required
            />
            <TextField
              id={`${prefix}-starts`} name="starts_on" type="date"
              label={tf('field.periodStarts')} mono required
            />
            <TextField
              id={`${prefix}-ends`} name="ends_on" type="date"
              label={tf('field.periodEnds')} mono required
            />
          </FieldRow>

          <FieldRow cols={3}>
            <TextField
              id={`${prefix}-expected`} name="expected_issuance"
              label={t('project.expectedIssuance')} hint={tf('field.expectedIssuanceHint')}
              unit={record.unitLabel ?? ''} mono required
            />
            <TextField
              id={`${prefix}-buffer`} name="buffer"
              label={t('project.buffer')} hint={tf('field.bufferHint')}
              unit={record.unitLabel ?? ''} mono required
            />
            <TextField
              id={`${prefix}-as-of`} name="forecast_as_of" type="date"
              label={tf('provenance.asOf')} defaultValue={today()} mono required
            />
          </FieldRow>

          <Note tone="rule">{tf('field.bufferRule')}</Note>
          <Note tone="rule">{tf('field.periodsRule')}</Note>

          <SourceFields prefix={prefix} defaultAsOf={today()} />
          <SubmitButton label={ownerText(t, 'recordThis')} />
        </form>
      )}
    </FormSection>
  );
}

/* ------------------------------------------------------------ 09 DOCUMENTS */

export async function DocumentsSection({ record }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');

  // The actor is read here rather than threaded through SectionProps: getActor()
  // is wrapped in React's cache(), so this is the same session the page already
  // resolved and not a second round trip.
  const actor = await getActor();

  return (
    <FormSection
      id="record-documents" n={9}
      title={t('project.documents')}
      lead={tf('section.documents.lead')}
    >
      {/* Until the documents work landed this said, plainly, that upload was
          not built - two of the ten items the publication list checks are
          documents, so it was the reason a complete-looking record still could
          not be published. It is built now: migration 0055 gives an owner an
          INSERT on doc.document and doc.document_version scoped by policy to
          its own project, and the panel below is the form over it. */}
      <ProjectDocumentsPanel
        actor={actor}
        projectId={record.id}
        slug={record.slug}
      />
    </FormSection>
  );
}

/* --------------------------------------------------- 10 SUBMIT FOR REVIEW */

export async function SubmitSection({ record }: SectionProps) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');

  const canSubmit = record.status === 'draft' || record.status === 'changes_requested';

  return (
    <FormSection
      id="record-submit" n={10}
      title={ownerText(t, 'submitTitle')}
      lead={ownerText(t, 'submitLead')}
    >
      {canSubmit ? (
        <form className={styles.form} action={submitForReviewAction}>
          <input type="hidden" name="slug" value={record.slug} />
          <div className={styles.actions}>
            <button type="submit" className={styles.submit}>
              {ownerText(t, 'submitAction')}
            </button>
          </div>
          <p className={styles.note}>
            {tf('actions.submitNote', {
              draft: t('status.draft'),
              review: t('status.submitted_for_review'),
            })}
          </p>
          <p className={styles.note}>{tf('actions.reviewNote')}</p>
        </form>
      ) : (
        <Note tone="rule">{ownerText(t, 'submitOnlyFromDraft')}</Note>
      )}
    </FormSection>
  );
}
