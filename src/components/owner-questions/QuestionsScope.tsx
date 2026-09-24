import { getTranslations } from 'next-intl/server';
import styles from './QuestionsScope.module.css';

/**
 * What the question box is, stated before the first question is read.
 *
 * The concept note (section 6) puts one sentence on this: "Plus a private
 * question box. Questions go to the project owner and to us, not to a public
 * comment feed." Three things follow from that sentence and an owner needs all
 * three before typing a reply: who else reads it, that nothing here is
 * published, and that the person asking is a label rather than a name.
 *
 * It is a description list because that is what it is - three terms and their
 * definitions - and because a screen reader then announces the term with its
 * body instead of reading three unrelated paragraphs.
 */
export default async function QuestionsScope() {
  const t = await getTranslations('ownerQuestions');

  const items = [
    { term: t('who.recipientsTitle'), body: t('who.recipientsBody') },
    { term: t('who.privateTitle'), body: t('who.privateBody') },
    { term: t('who.identityTitle'), body: t('who.identityBody') },
  ];

  return (
    <section className={styles.scope} aria-labelledby="owner-questions-who">
      <h2 id="owner-questions-who" className={styles.title}>
        {t('who.title')}
      </h2>

      <dl className={styles.list}>
        {items.map((item) => (
          <div key={item.term} className={styles.item}>
            <dt className={styles.term}>{item.term}</dt>
            <dd className={styles.body}>{item.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
