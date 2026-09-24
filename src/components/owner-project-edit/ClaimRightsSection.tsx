import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import ProvenanceStrip from './ProvenanceStrip';
import { AddEntry, RepeatEntry } from './RepeatGroup';
import { FieldRow, Note, TextField } from './Fields';
import { CLAIMS, SECTION } from './project-draft-data';

/**
 * Claim rights, one entry per benefit the project produces.
 *
 * Buyers told the client this section can decide whether they take part at all
 * (concept note, section 3), so it is four plain statements per benefit rather
 * than a paragraph of contract language - and, like a figure, each statement
 * carries the document it comes from and the date it is stated as of.
 */
export default async function ClaimRightsSection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  return (
    <FormSection
      id={SECTION.claims}
      n={5}
      title={tRoot('project.claimRights')}
      lead={t('section.claims.lead')}
    >
      {CLAIMS.map((claim, index) => (
        <RepeatEntry
          key={claim.id}
          legend={t('repeat.claim', { n: index + 1 })}
          removeLabel={t('repeat.remove')}
        >
          <FieldRow>
            <TextField
              id={`claim-${claim.id}-benefit`}
              label={tRoot('project.benefit')}
              hint={t('field.benefitHint')}
              defaultValue={t(claim.benefitKey)}
              rows={2}
              required
            />
            <TextField
              id={`claim-${claim.id}-holder`}
              label={tRoot('project.claimHolder')}
              hint={t('field.holderHint')}
              defaultValue={t(claim.holderKey)}
              rows={2}
              required
            />
          </FieldRow>

          <FieldRow>
            <TextField
              id={`claim-${claim.id}-allowed`}
              label={tRoot('project.allowedUse')}
              hint={t('field.allowedHint')}
              defaultValue={t(claim.allowedKey)}
              rows={3}
              required
            />
            <TextField
              id={`claim-${claim.id}-excluded`}
              label={tRoot('project.exclusions')}
              hint={t('field.excludedHint')}
              defaultValue={t(claim.excludedKey)}
              rows={3}
              required
            />
          </FieldRow>

          <ProvenanceStrip
            idBase={`claim-${claim.id}`}
            sourceDocId={claim.sourceDocId}
            locator={claim.locator}
            asOfDate={claim.asOfDate}
          />
        </RepeatEntry>
      ))}

      <AddEntry label={t('repeat.addClaim')} note={t('repeat.addClaimNote')} />

      <Note tone="rule">{t('field.claimsRule')}</Note>
    </FormSection>
  );
}
