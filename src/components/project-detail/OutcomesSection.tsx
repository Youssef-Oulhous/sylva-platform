import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { label, UI } from '@/lib/projects/labels';
import type { OutcomeFigure, OutcomeIndicator, ProjectDetail } from '@/lib/projects/types';
import styles from './OutcomesSection.module.css';

/**
 * Water and biodiversity, in two separate tables.
 *
 * They are separate because they measure unrelated things and a reader must not
 * be able to read one against the other. There is deliberately no combined
 * score, no weighting and no roll-up: the concept note's buyers rank water
 * first and biodiversity second, and a single number would hide exactly the
 * distinction they are paying attention to.
 *
 * Every figure prints its own measure unit beside it. These are indicator
 * units - "cm below ground", "condition score 0-100" - not units of trade, and
 * they are never added to anything. The uncertainty column shows the recorded
 * range where the project stated one, and the indicator's own note where it did
 * not; an empty cell means the project stated no uncertainty, which is itself
 * something a buyer is entitled to see.
 */
export default async function OutcomesSection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();
  const format = await getFormatter();

  const figure = (f: OutcomeFigure | null) => {
    if (!f) return <span className={styles.absent}>—</span>;
    return (
      <>
        {format.number(f.amount)}{' '}
        <span className={styles.unit}>{f.measureUnit}</span>
      </>
    );
  };

  const uncertainty = (o: OutcomeIndicator) => {
    const f = o.target ?? o.baseline;
    if (f?.uncertaintyLow !== null && f?.uncertaintyLow !== undefined
        && f.uncertaintyHigh !== null) {
      return (
        <>
          {format.number(f.uncertaintyLow)}–{format.number(f.uncertaintyHigh)}{' '}
          <span className={styles.unit}>{f.measureUnit}</span>
        </>
      );
    }
    return o.uncertaintyNote ?? <span className={styles.absent}>—</span>;
  };

  const block = (domain: 'water' | 'biodiversity', rows: OutcomeIndicator[]) => {
    const heading = domain === 'water' ? t('project.water') : t('project.biodiversity');
    return (
      <section
        key={domain}
        className={domain === 'water' ? styles.blockWater : styles.blockBio}
        aria-labelledby={`outcomes-${domain}`}
      >
        <div className={styles.blockHead}>
          <h3 id={`outcomes-${domain}`} className={styles.blockTitle}>
            {heading}
          </h3>
          <Badge tone={domain === 'water' ? 'water' : 'bio'}>
            {domain === 'water'
              ? t('projectPage.outcomes.waterDomain')
              : t('projectPage.outcomes.bioDomain')}
          </Badge>
        </div>
        <p className={styles.blockNote}>
          {domain === 'water'
            ? t('projectPage.outcomes.waterNote')
            : t('projectPage.outcomes.bioNote')}
        </p>

        {rows.length === 0 ? (
          <p className={styles.blockNote}>{label(t, UI.noOutcomes)}</p>
        ) : (
          <div className="table-scroll">
            <table>
              <caption>
                {domain === 'water'
                  ? t('projectPage.outcomes.waterCaption')
                  : t('projectPage.outcomes.bioCaption')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('project.metric')}</th>
                  <th scope="col" className="num">{t('project.baseline')}</th>
                  <th scope="col" className="num">{t('project.expected')}</th>
                  <th scope="col">{t('project.method')}</th>
                  <th scope="col">{t('project.verifier')}</th>
                  <th scope="col" className="num">{t('project.uncertainty')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <th scope="row" className={styles.rowHead}>
                      {r.whatIsMeasured?.body ?? r.code}
                      <FallbackNote text={r.whatIsMeasured} />
                      <SourceStamp
                        source={{
                          label: (r.target ?? r.baseline ?? r).source.label,
                          locator: (r.target ?? r.baseline ?? r).source.locator,
                          asOfDate: (r.target ?? r.baseline ?? r).source.asOfDate,
                        }}
                      />
                    </th>
                    <td className={`num ${styles.figure}`}>{figure(r.baseline)}</td>
                    <td className={`num ${styles.figure} ${styles.expected}`}>
                      {figure(r.target)}
                    </td>
                    <td className={styles.method}>
                      {r.methodNote?.body ?? '—'}
                      <FallbackNote text={r.methodNote} />
                    </td>
                    <td>{r.verifierName ?? <span className={styles.absent}>—</span>}</td>
                    <td className={`num ${styles.figure}`}>{uncertainty(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <h2>{t('project.outcomes')}</h2>
      <p className={styles.lead}>{t('projectPage.outcomes.lead')}</p>
      <p className={styles.noScore}>{t('projectPage.outcomes.noCombinedScore')}</p>

      <div className={styles.blocks}>
        {block('water', project.outcomes.filter((o) => o.domain === 'water'))}
        {block('biodiversity', project.outcomes.filter((o) => o.domain === 'biodiversity'))}
      </div>
    </>
  );
}
