-- ============================================================================
-- DEMO PASSWORDS  ·  every demo account, one shared password
-- ============================================================================
--
--     password:  demo-password-not-for-production
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
  ('owner.a@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$WlSe/gLDX/ovNLrH+YYCIA==$WR+94iWe2ET1E+tH8URdGUOxBrO4kfLkR0YfUihO0MWWcT1zTJLW0PPIouH5LdWbSK5htZiYr1IL9gQda3Lxdw=='),
  ('owner.b@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$G1In0Ln0V+r+nv84zcRFqw==$S2X/S/2+OTpJ1I2lmPtyqph43/uoNPBy/whJbh8NjOH2iOydKk/+Mo+Nmt3HI3LBmD15LvfVwZB67QqDMs/6xg=='),
  ('buyer.a@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$dVy60cUuDu0kh6J49Q/yFw==$nzvdsMySdCkno6PBplpDwD3dcfw/HREDu3FqtslDrmwsqODeTNLroIVq8S6tTt2Xgn9u/SPsAqgPSdtcB0ZFHw=='),
  ('buyer.b@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$8IdaBb7rLg8BFZMc4vh3SQ==$AegkXch4gOpgfSjrHlf4IniAv0rEVDji5qlBMqiFbQPOhlFVNiBt3zDcEbBMkEzNfp919Zgm2bUGZwbzAaRKYw=='),
  ('investor.a@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$nX/f6o+NMzCoYfRb1NrxwA==$36iA5tIVvSSpJhNGAbKZl5lLfZc8vr+SyZQf4EL7viygw34l7/sawy/X36YXAxvF2gsazvbHbgc/WKW1F3W6qw=='),
  ('investor.b@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$knYO5hbwKY38EwzSCrzTwA==$kO5J8jGZS9iWPY8VJgeDeRPzzzX/bIejP9NO4KAmWc0UunFMUyRrdJzPTQRZPks8jztDYRjJlEl+Vweo4POvEQ=='),
  ('operator@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$22LDtjoQWWirCdKN133EvQ==$pT2sazxAOWTnBNEtoMfekZ5tclCapgl6G0v1LumezcqUe13Z+aaZPFP1vzpowUmP4t0Z6Cv6iCFIAqm6kC0yxQ=='),
  ('auditor@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$vd7r3ZaxRFPQWcXj5UIMwA==$GSrMiCG60ZDvh/etZoLsBAGBleoxMBcPm8uHZdwHpsSS3exfjb00TBk8Y8/e+AMURduoVdLCbM1IDGemmQA6Cg=='),
  ('unvetted@demo.sylva.example', 'scrypt$N=16384,r=8,p=1,len=64$qAENW8jMdyyBMkzKWDuj0g==$Kj88fPh4+Z07jjqxBzQR9drLRKjjDAWZwP5H8LVPeT3PTGf3BSaGyfLdrrdYiGYSxxR+2OTbl7kieAHm6Uv7ig==')
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
