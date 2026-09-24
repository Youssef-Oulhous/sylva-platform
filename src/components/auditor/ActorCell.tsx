import { useTranslations } from 'next-intl';
import { AUDIT, label } from '@/lib/auditor/labels';
import { formerMemberText, resolvePerson } from '@/lib/auditor/people';
import type { AuditActor } from '@/lib/auditor/types';
import styles from './Auditor.module.css';

/**
 * Who did this, as far as the database can still say.
 *
 * Three outcomes, and the difference between them is the whole reason this is
 * a component rather than a string:
 *
 *   named    the account still exists. The auditor is the one role that sees a
 *            real person's name, and it sees it here.
 *   erased   the entry names a person_ref no account resolves. Under
 *            docs/DECISIONS.md D3 that is ERASURE: the entry is unchanged and
 *            only the lookup fails. It is rendered as "Former member —
 *            {Organisation}" and never as a blank cell, because a blank cell
 *            invites the reader to wonder whether something was removed.
 *   none     the entry carries no person at all.
 *
 * The organisation is always printed. It survives erasure and it is what the
 * record remains attributable to.
 */
export default function ActorCell({ actor }: { actor: AuditActor }) {
  const t = useTranslations();
  const person = resolvePerson(actor);
  const orgName = actor.orgName ?? label(t, AUDIT.unknownOrg);

  return (
    <div>
      <span>{orgName}</span>
      <span className={styles.sub}>
        {person.kind === 'named' && person.name}
        {person.kind === 'erased' && (
          <span className={styles.erased}>
            {formerMemberText(
              label(t, AUDIT.formerMember),
              actor.orgName,
              label(t, AUDIT.unknownOrg),
            )}
          </span>
        )}
        {person.kind === 'none' && (
          <span className={styles.erased}>{label(t, AUDIT.noPerson)}</span>
        )}
      </span>
      <span className={styles.sub}>{actor.roleAtTime}</span>
    </div>
  );
}
