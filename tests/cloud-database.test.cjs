const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('PostgreSQL: Mandantentrennung, Modulrechte und konkurrierende Speicherung',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
   grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;`);
  await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/tests/tenant-isolation.sql','utf8'));
  assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count,0);
 } finally { await db.close(); }
});
