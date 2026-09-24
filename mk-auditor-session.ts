import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { newSessionToken } from '@/lib/auth/tokens';
import { authSaltFor, authenticate, openSession } from '@/lib/auth/queries';
import { deriveFromPrefix } from '@/lib/auth/password';
import { closeAllPools } from '@/lib/db/pool';

async function main() {
  const email = 'auditor@demo.sylva.example';
  const prefix = await authSaltFor(email);
  const key = await deriveFromPrefix(prefix!, 'demo-password-not-for-production');
  const account = await authenticate(email, key);
  if (!account) throw new Error('no account');
  const token = newSessionToken();
  await openSession(account.userId, token.digest, 3600);
  console.log(token.raw);
  await closeAllPools();
}
main();
