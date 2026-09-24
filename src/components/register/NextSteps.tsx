import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './NextSteps.module.css';

/**
 * Account created, then vetting, then a decision.
 *
 * The point of the section is that registering is not the same as being
 * approved. "No deal can be created for an organisation we have not approved"
 * is rule 6 of the concept note (§8), so an organisation that has just
 * registered can read the platform and nothing more. Each step therefore states
 * both halves: what the organisation can do at that point, and what is still
 * closed to it. A reader who skips the second half is exactly the reader who
 * will be surprised later.
 *
 * An ordered list, because the order is the content. The step number is not the
 * only marker of progress - each step carries who acts, as a word.
 */

interface Stage {
  id: string;
  nameKey: string;
  actorKey: string;
  bodyKey: string;
  canKey: string;
  limitLabelKey: string;
  limitKey: string;
}

const STAGES: readonly Stage[] = [
  {
    id: 'account',
    nameKey: 'register.next.s1.name',
    actorKey: 'register.next.actorYou',
    bodyKey: 'register.next.s1.body',
    canKey: 'register.next.s1.can',
    limitLabelKey: 'register.next.s1.limitLabel',
    limitKey: 'register.next.s1.limit',
  },
  {
    id: 'vetting',
    nameKey: 'register.next.s2.name',
    actorKey: 'register.next.actorSylva',
    bodyKey: 'register.next.s2.body',
    canKey: 'register.next.s2.can',
    limitLabelKey: 'register.next.s2.limitLabel',
    limitKey: 'register.next.s2.limit',
  },
  {
    id: 'decision',
    nameKey: 'register.next.s3.name',
    actorKey: 'register.next.actorSylva',
    bodyKey: 'register.next.s3.body',
    canKey: 'register.next.s3.can',
    limitLabelKey: 'register.next.s3.limitLabel',
    limitKey: 'register.next.s3.limit',
  },
];

/**
 * DEMO DATA. The shape of the vetting questionnaire, as a figure with its
 * source and date. The real questionnaire wording comes from the client.
 */
const QUESTIONNAIRE = {
  parts: 4,
  questions: 18,
  version: 'v1.2',
  asOfDate: '2026-09-10',
} as const;

export default async function NextSteps() {
  const t = await getTranslations();

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{t('register.next.intro')}</p>

      <ol className={styles.stages}>
        {STAGES.map((stage, index) => (
          <li key={stage.id} className={styles.stage}>
            <div className={styles.stageHead}>
              <span className={styles.stageNum}>
                {t('register.next.stageLabel')} {index + 1}
              </span>
              <Badge tone="neutral">{t(stage.actorKey)}</Badge>
            </div>

            <h3 className={styles.stageName}>{t(stage.nameKey)}</h3>
            <p className={styles.stageBody}>{t(stage.bodyKey)}</p>

            {stage.id === 'vetting' ? (
              <div className={styles.figure}>
                <span className={styles.figureLabel}>
                  {t('register.next.s2.questionnaireLabel')}
                </span>
                <span className={styles.figureValue}>
                  {t('register.next.s2.questionnaireFigure', {
                    parts: QUESTIONNAIRE.parts,
                    questions: QUESTIONNAIRE.questions,
                  })}
                </span>
                <SourceStamp
                  source={{
                    label: t('register.next.s2.questionnaireSource'),
                    locator: QUESTIONNAIRE.version,
                    asOfDate: QUESTIONNAIRE.asOfDate,
                  }}
                />
                <Link href="/for-buyers#vetting" className={styles.figureLink}>
                  {t('register.next.s2.questionnaireLink')}
                </Link>
              </div>
            ) : null}

            <dl className={styles.detail}>
              <dt className={styles.detailTerm}>{t('register.next.canLabel')}</dt>
              <dd className={styles.detailValue}>{t(stage.canKey)}</dd>
              <dt className={styles.detailTerm}>{t(stage.limitLabelKey)}</dt>
              <dd className={styles.detailValue}>{t(stage.limitKey)}</dd>
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}
