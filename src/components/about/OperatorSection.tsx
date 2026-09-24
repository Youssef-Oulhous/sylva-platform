import { getTranslations } from 'next-intl/server';
import FactList from './FactList';
import { OPERATOR_DUTIES } from './about-data';
import shared from './AboutSection.module.css';

/**
 * Who operates the platform, and what operating it consists of.
 *
 * Written as five duties rather than as an "about us" paragraph: a reader
 * deciding whether to transact here needs to know which acts are ours, so the
 * acts are the content and each one names the section of the concept note it
 * comes from.
 */
export default async function OperatorSection() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('about.operator.title')}</h2>
      <p className={shared.lead}>{t('about.operator.lead')}</p>

      <h3 className={shared.subhead}>{t('about.operator.dutiesTitle')}</h3>
      <FactList facts={OPERATOR_DUTIES} />
    </>
  );
}
