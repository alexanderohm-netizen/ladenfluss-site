# Cloud foundation — implementation, not production release

Project: `ladenfluss`, Supabase `nzxtdrmdvqyvcbohplzt`, Frankfurt (`eu-central-1`).
Initial project creation was approved at quoted recurring cost 0/month.
Stripe target approved separately: Ladenfluss Sandbox, testmode only. No Stripe products,
prices, subscriptions, payment links or checkout integration have been created.

## Implemented
- Pinned Supabase JS SDK, locally served UMD with upstream MIT license.
- Account UI: email/password signup, signin, password recovery, local signout.
- PKCE flow. Passwords cleared after submissions. Session handled by official SDK.
- Company create/read/rename backed by Supabase. Transactional owner and main branch creation.
- Five RLS tables: companies, company_members, branches, module_access, cloud_documents.
- Internal membership/entitlement checks use database records, not user-editable metadata.
- Clients cannot grant membership or activate modules. Paid access requires a non-expired
  active/trial entitlement. No billing source is wired yet, so no paid access is granted.
- Revision-checked document save RPC; generic JSON storage is preparation only and is not
  yet called by the PEP, vacation, numbers or inventory UI.
- One owned company per user initially; employees can see basic company/branch information
  but cannot access bulk business documents. No invitations implemented yet.
- Existing free tools/local data stay unchanged. No bulk transfer of real customer data.

## Verification
- 53 local tests passed: existing 48 + four account flow tests with mocked auth/client
  + one PostgreSQL/PGlite test executing the schema and security scenarios.
- Database test verifies owner creation, cross-tenant read/write denial, anonymous denial,
  denied self activation, unpaid/expired module denial, allowed trial and revision conflicts.
- Remote schema applied successfully. Supabase security advisors returned no findings;
  live catalog confirms RLS enabled for all five tables.
- Remote fixture test could not run: connector returned Invalid or expired requestState
  twice. The local SQL suite is not a substitute for full live user-session verification.

## Before releasing account UI
1. Supabase Auth URL Configuration: Site URL `https://www.ladenfluss.de/konto`;
   redirects `https://www.ladenfluss.de/konto` and `https://www.ladenfluss.de/konto?recovery=1`.
   Add only the exact review preview URL if testing there. No blanket wildcard.
2. Verify email confirmation is enabled. Configure production email delivery (SMTP)
   and inspect Supabase sender limits before public signup.
3. End-to-end verify registration -> confirmation in same browser (PKCE) -> login ->
   company -> second device -> logout -> password recovery. Verify live isolation.
4. Complete privacy notice/provider contract and retention/export/deletion workflow review.
   Current added privacy text describes implementation only, not a complete legal review.
5. Do not merge until those gates are satisfied. Dashboard settings require browser access;
   the Supabase connector does not expose Auth configuration updates.

## Next paid-module slice
Agree PEP price and test duration. Stripe Checkout subscription in approved sandbox,
server-derived company/price mapping, signed webhook with idempotency, server-side
entitlements, expiry/cancellation handling and customer portal. Never unlock from the
success redirect alone. PEP's existing local page is not paywalled by this change.
Numbers and inventory require actual input workflows and data validation before release.
