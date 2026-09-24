/**
 * Regenerates db/seed/0006_demo_passwords.sql.
 *
 *   npx tsx scripts/make-demo-passwords.ts > db/seed/0006_demo_passwords.sql
 *
 * The seed has to contain literal scrypt records because PostgreSQL cannot
 * compute scrypt - see the header of db/migrations/0040. Each run produces a
 * different file: the salts are random, which is the point. Committing the
 * output is fine and intended; it is demo data and the password it hashes is
 * printed in the file.
 */
import { hashPassword } from '../src/lib/auth/password';

const DEMO_PASSWORD = 'demo-password-not-for-production';

const EMAILS = [
  'owner.a@demo.sylva.example',
  'owner.b@demo.sylva.example',
  'buyer.a@demo.sylva.example',
  'buyer.b@demo.sylva.example',
  'investor.a@demo.sylva.example',
  'investor.b@demo.sylva.example',
  'operator@demo.sylva.example',
  'auditor@demo.sylva.example',
  'unvetted@demo.sylva.example',
];

async function main(): Promise<void> {
  const rows: string[] = [];
  for (const email of EMAILS) {
    // A fresh salt per account, so two demo users with the same password do not
    // share a hash. Anything else would teach the wrong lesson from the seed.
    rows.push(`  ('${email}', '${await hashPassword(DEMO_PASSWORD)}')`);
  }

  process.stdout.write(`-- ============================================================================
-- DEMO PASSWORDS  ·  every demo account, one shared password
-- ============================================================================
--
--     password:  ${DEMO_PASSWORD}
--
-- It is written here in plain text on purpose. These are demo accounts on demo
-- organisations whose names all begin with "DEMO ", in a database that also
-- ships a demo actor-context signing key. Nothing here is a secret, and
-- pretending otherwise would hide which accounts a reviewer can actually use.
--
-- A DEPLOYED environment must not run this file, for the same reason it must
-- not run db/seed/0000_bootstrap.sql.
--
-- The values below are scrypt records:
--
--     scrypt$N=16384,r=8,p=1,len=64$<salt base64>$<derived key base64>
--
-- PostgreSQL cannot produce them - pgcrypto has no scrypt and this machine has
-- no compiler for one - so they are generated in Node and pasted here.
-- Regenerate with:
--
--     npx tsx scripts/make-demo-passwords.ts > db/seed/0006_demo_passwords.sql
--
-- Each account has its own random salt, so the nine identical passwords do not
-- produce nine identical hashes.
-- ============================================================================

UPDATE identity.user_account u
   SET password_hash = v.hash
  FROM (VALUES
${rows.join(',\n')}
  ) AS v(email, hash)
 WHERE u.email = v.email::citext;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM identity.user_account
   WHERE email LIKE '%@demo.sylva.example' AND password_hash IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '% demo account(s) still have no password; '
      'db/seed/0001_demo_reference.sql and this file have drifted apart', n;
  END IF;
  RAISE NOTICE 'demo passwords set for % accounts',
    (SELECT count(*) FROM identity.user_account WHERE email LIKE '%@demo.sylva.example');
END $$;
`);
}

void main();
