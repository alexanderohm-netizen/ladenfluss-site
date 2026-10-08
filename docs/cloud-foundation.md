# Cloud foundation — implementation, not production release

Project: `ladenfluss`, Supabase `nzxtdrmdvqyvcbohplzt`, Frankfurt (`eu-central-1`).
Initial project creation was approved at quoted recurring cost 0/month.
Stripe target approved separately: Ladenfluss Sandbox, testmode only,
`acct_1UO0PELuBESyH3u9`. Product `prod_VP6NVdxlEdG1Hv` (Ladenfluss PEP) was created
and read back on 2026-10-08. It is inactive, has no default price, and `livemode=false`.
No prices, subscriptions, payment links or hosted webhook endpoint exist yet.
Sandbox checkout/webhook code is now prepared; see `billing-setup.md` for deployment gates.

## Implemented
- Pinned Supabase JS SDK, locally served UMD with upstream MIT license.
- Account UI: email/password signup, signin, password recovery, local signout.
- Explicit PKCE code exchange through the official SDK, including flow IDs. Invalid,
  expired and wrong-browser links show recovery guidance; a URL flag alone cannot open
  the password-change form. One-time codes/provider errors are removed from browser history.
- Passwords cleared after submissions. Session handled by official SDK. Account data is
  cleared immediately on a signout event, including when another tab signs out.
- Network failures remain distinguishable from signed-out sessions and offer retry.
- Account page has a restrictive CSP and no-referrer policy.
- Branded confirmation/recovery email templates are prepared in `supabase/templates/`.
  They are not installed in the hosted project's Auth configuration yet.
- Company create/read/rename backed by Supabase. Transactional owner and main branch creation.
- Five RLS tables: companies, company_members, branches, module_access, cloud_documents.
- Internal membership/entitlement checks use database records, not user-editable metadata.
- Clients cannot grant membership or activate modules. Paid access requires a non-expired
  active/trial entitlement. The sandbox billing source is implemented but not deployed, so it grants no hosted paid access yet.
- Revision-checked document save RPC; generic JSON storage is preparation only and is not
  yet called by the PEP, vacation, numbers or inventory UI.
- One owned company per user initially; employees can see basic company/branch information
  but cannot access bulk business documents. No invitations implemented yet.
- Existing free tools/local data stay unchanged. No bulk transfer of real customer data.

## Verification
- 78 local tests: existing 48, nine account tests, one PostgreSQL/PGlite test
  executing baseline and billing security scenarios, 16 billing backend tests and
  four billing UI tests. Provider responses are mocked; signatures use the real SDK.
- Three additional browser tests exercise the shipped SDK's actual PKCE verifier,
  callback, password update and error paths with HTTP responses intercepted. They do
  not prove live Supabase mail delivery or a real cross-device customer session.
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
   and inspect Supabase sender limits before public signup. Enforce a minimum password
   length of 12 on the server too, matching the forms.
   The built-in mail service only sends to project team members and is unsuitable for
   public signup: https://supabase.com/docs/guides/auth/auth-smtp
   Existing business email is GoDaddy Microsoft 365 (`info@ladenfluss.de`); preserve
   its mailbox and MX records. No transactional mail provider has been provisioned.
   Install `confirmation.html` as Confirm signup, subject `Bestätige deine E-Mail-Adresse · Ladenfluss`,
   and `recovery.html` as Reset password, subject `Dein neues Passwort · Ladenfluss`.
   Keep Supabase's `{{ .ConfirmationURL }}` intact and disable provider link tracking.
3. End-to-end verify registration -> confirmation in same browser (PKCE) -> login ->
   company -> second device -> logout -> password recovery. Verify live isolation.
4. Complete privacy notice/provider contract and retention/export/deletion workflow review.
   Current added privacy text describes implementation only, not a complete legal review.
5. Do not merge until those gates are satisfied. Dashboard settings require browser access;
   the Supabase connector does not expose Auth configuration updates.

## Next paid-module slice
Stripe Checkout, server-derived company/price mapping, signed idempotent webhooks,
entitlements, cancellation handling and Customer Portal are implemented for the approved
sandbox. The billing migration failed with `Invalid or expired requestState`; a readback
confirmed no billing tables and no Edge Functions. See `billing-setup.md`. Agree the PEP
price and any trial before activation. Never unlock from the success redirect alone.
PEP's existing local page is not paywalled. Build its paid cloud workflow before allowing
customers to subscribe.
Numbers and inventory require actual input workflows and data validation before release.
Price/tax behavior must be agreed before checkout activation; only enable Stripe Tax
after verifying active registrations. Use a restricted test key in the hosting secrets
settings, never committed source. A connected Stripe tool is not an application API key.
