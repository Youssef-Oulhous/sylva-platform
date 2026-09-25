import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { label, QUESTIONS } from '@/lib/admin/labels';
import { QUESTION_STATES, type QuestionState } from '@/lib/admin/questions';
import styles from './AdminArea.module.css';

/**
 * Which questions to show. A GET form, so the view is in the address and the
 * only control on this page cannot write anything.
 */
export default async function QuestionFilter({ state }: { state: QuestionState }) {
  const t = await getTranslations();
  const names: Record<QuestionState, string> = {
    all: label(t, QUESTIONS.filterAll),
    open: label(t, QUESTIONS.filterOpen),
    answered: label(t, QUESTIONS.filterAnswered),
  };

  return (
    <form className={styles.filters} method="get" action="">
      <p className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="question-state">
          {label(t, QUESTIONS.filterLabel)}
        </label>
        <select
          className={styles.select}
          id="question-state"
          name="state"
          defaultValue={state}
        >
          {QUESTION_STATES.map((s) => (
            <option key={s} value={s}>{names[s]}</option>
          ))}
        </select>
      </p>
      <button className={styles.apply} type="submit">{label(t, QUESTIONS.filterSubmit)}</button>
      {state !== 'all' && (
        <Link className={styles.clear} href="/admin/questions">
          {label(t, QUESTIONS.filterAll)}
        </Link>
      )}
    </form>
  );
}
