import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './VettingPreview.module.css';

/**
 * A preview of the vetting questionnaire.
 *
 * Vetting is what stands between a company and a deal, so a buyer should be
 * able to see the shape of it before signing in: four parts, and the three
 * questions the client actually cares about - what you intend to claim, how you
 * operate, how you approach sustainability.
 *
 * FRONTEND PASS. The form renders and does nothing. There is no action, no
 * server action and no client handler; the fields are uncontrolled, so this
 * whole section stays a Server Component. The submit control is marked
 * aria-disabled rather than removed, so a keyboard reader still finds it and
 * the note explaining why it is inert.
 */

type FieldKind = 'text' | 'select' | 'textarea' | 'choice';

interface VettingField {
  id: string;
  kind: FieldKind;
  labelKey: string;
  hintKey: string | null;
  required: boolean;
  /** Option label keys for a select or a choice. Empty for the other kinds. */
  optionKeys: readonly string[];
}

interface VettingPart {
  id: string;
  titleKey: string;
  fields: readonly VettingField[];
}

/**
 * DEMO DATA. A preview of a fictional questionnaire, not the questionnaire
 * itself. The wording of the real one comes from the client.
 */
const QUESTIONNAIRE = {
  questionCount: 18,
  partCount: 4,
  source: { labelKey: 'forBuyers.source.questionnaire', locator: 'v1.2', asOfDate: '2026-09-10' },
} as const;

const PARTS: readonly VettingPart[] = [
  {
    id: 'organisation',
    titleKey: 'forBuyers.vetting.partOrganisation',
    fields: [
      {
        id: 'legal-name',
        kind: 'text',
        labelKey: 'forBuyers.vetting.legalName.label',
        hintKey: 'forBuyers.vetting.legalName.hint',
        required: true,
        optionKeys: [],
      },
      {
        id: 'sector',
        kind: 'select',
        labelKey: 'forBuyers.vetting.sector.label',
        hintKey: 'forBuyers.vetting.sector.hint',
        required: true,
        optionKeys: [
          'forBuyers.vetting.sector.optionFood',
          'forBuyers.vetting.sector.optionEnergy',
          'forBuyers.vetting.sector.optionManufacturing',
          'forBuyers.vetting.sector.optionFinance',
          'forBuyers.vetting.sector.optionOther',
        ],
      },
      {
        id: 'country',
        kind: 'text',
        labelKey: 'forBuyers.vetting.country.label',
        hintKey: null,
        required: true,
        optionKeys: [],
      },
      {
        id: 'disclosure',
        kind: 'choice',
        labelKey: 'forBuyers.vetting.disclosure.label',
        hintKey: 'forBuyers.vetting.disclosure.hint',
        required: false,
        optionKeys: [
          'forBuyers.vetting.disclosure.optionPseudonymous',
          'forBuyers.vetting.disclosure.optionNamed',
        ],
      },
    ],
  },
  {
    id: 'claims',
    titleKey: 'forBuyers.vetting.partClaims',
    fields: [
      {
        id: 'intended-claim',
        kind: 'textarea',
        labelKey: 'forBuyers.vetting.claim.label',
        hintKey: 'forBuyers.vetting.claim.hint',
        required: true,
        optionKeys: [],
      },
    ],
  },
  {
    id: 'operations',
    titleKey: 'forBuyers.vetting.partOperations',
    fields: [
      {
        id: 'operations',
        kind: 'textarea',
        labelKey: 'forBuyers.vetting.operations.label',
        hintKey: 'forBuyers.vetting.operations.hint',
        required: true,
        optionKeys: [],
      },
    ],
  },
  {
    id: 'sustainability',
    titleKey: 'forBuyers.vetting.partSustainability',
    fields: [
      {
        id: 'sustainability',
        kind: 'textarea',
        labelKey: 'forBuyers.vetting.sustainability.label',
        hintKey: 'forBuyers.vetting.sustainability.hint',
        required: true,
        optionKeys: [],
      },
    ],
  },
];

export default async function VettingPreview() {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <h2>{t('forBuyers.vetting.title')}</h2>
      <p className={styles.lead}>{t('forBuyers.vetting.lead')}</p>

      <div className={styles.figures}>
        <p className={styles.figure}>
          <span className={styles.figureValue}>{format.number(QUESTIONNAIRE.questionCount)}</span>
          <span className={styles.figureLabel}>{t('forBuyers.vetting.questionsLabel')}</span>
        </p>
        <p className={styles.figure}>
          <span className={styles.figureValue}>{format.number(QUESTIONNAIRE.partCount)}</span>
          <span className={styles.figureLabel}>{t('forBuyers.vetting.partsLabel')}</span>
        </p>
      </div>
      <SourceStamp
        source={{
          label: t(QUESTIONNAIRE.source.labelKey),
          locator: QUESTIONNAIRE.source.locator,
          asOfDate: QUESTIONNAIRE.source.asOfDate,
        }}
      />

      <div className={styles.formPanel}>
        <div className={styles.formHead}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <p id="vetting-preview-note" className={styles.previewNote}>
            {t('forBuyers.vetting.previewNote')}
          </p>
        </div>

        {/* No action, no method, no handler: the form is here to be read. */}
        <form className={styles.form} noValidate>
          {PARTS.map((part, partIndex) => (
            <fieldset key={part.id} className={styles.part}>
              <legend className={styles.partLegend}>
                <span className={styles.partNum} aria-hidden="true">
                  {String(partIndex + 1).padStart(2, '0')}
                </span>
                {t(part.titleKey)}
              </legend>

              {part.fields.map((field) => (
                <VettingFieldView
                  key={field.id}
                  field={field}
                  label={t(field.labelKey)}
                  hint={field.hintKey ? t(field.hintKey) : null}
                  requiredLabel={t('forBuyers.vetting.required')}
                  optionLabels={field.optionKeys.map((key) => ({ key, label: t(key) }))}
                  selectPlaceholder={t('forBuyers.vetting.selectPlaceholder')}
                />
              ))}
            </fieldset>
          ))}

          <div className={styles.formFoot}>
            <button
              type="button"
              className={styles.submit}
              aria-disabled="true"
              aria-describedby="vetting-preview-note"
            >
              {t('forBuyers.vetting.submit')}
            </button>
            <p className={styles.remaining}>{t('forBuyers.vetting.remaining')}</p>
          </div>
        </form>
      </div>

      <p className={styles.decision}>{t('forBuyers.vetting.decision')}</p>
    </>
  );
}

/** One question. The label is always a real label bound to a real control. */
function VettingFieldView({
  field,
  label,
  hint,
  requiredLabel,
  optionLabels,
  selectPlaceholder,
}: {
  field: VettingField;
  label: string;
  hint: string | null;
  requiredLabel: string;
  optionLabels: readonly { key: string; label: string }[];
  selectPlaceholder: string;
}) {
  const inputId = `vetting-${field.id}`;
  const hintId = hint ? `${inputId}-hint` : undefined;

  // A group of radios is labelled by a legend, not by a label element.
  if (field.kind === 'choice') {
    return (
      <fieldset className={styles.choiceGroup}>
        <legend className={styles.label}>{label}</legend>
        {hint && <p className={styles.hint}>{hint}</p>}
        <div className={styles.choices}>
          {optionLabels.map((option, index) => (
            <label key={option.key} className={styles.choice} htmlFor={`${inputId}-${index}`}>
              <input
                type="radio"
                id={`${inputId}-${index}`}
                name={inputId}
                value={option.key}
                defaultChecked={index === 0}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {field.required && <span className={styles.requiredWord}>{requiredLabel}</span>}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}

      {field.kind === 'text' && (
        <input
          type="text"
          id={inputId}
          name={inputId}
          className={styles.input}
          aria-describedby={hintId}
        />
      )}

      {field.kind === 'select' && (
        <select id={inputId} name={inputId} className={styles.input} aria-describedby={hintId} defaultValue="">
          <option value="" disabled>
            {selectPlaceholder}
          </option>
          {optionLabels.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.kind === 'textarea' && (
        <textarea
          id={inputId}
          name={inputId}
          rows={3}
          className={`${styles.input} ${styles.textarea}`}
          aria-describedby={hintId}
        />
      )}
    </div>
  );
}
