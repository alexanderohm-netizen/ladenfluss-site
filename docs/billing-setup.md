# PEP billing: sandbox implementation, not released

## Verified state on 2026-10-08

Account: Ladenfluss Sandbox (`acct_1UO0PELuBESyH3u9`). Product:
`prod_VP6NVdxlEdG1Hv`, inactive, no default price. No amount, trial or tax treatment
has been approved. No real charges are authorized.

Checkout, Customer Portal and signed webhook handlers are implemented in
`supabase/functions/`. The account page exposes sandbox controls only when the
server reports complete configuration. A return URL never grants access.
The existing local PEP page remains available; paid PEP cloud editing is still to
be implemented. Do not enable purchases before the paid feature is usable.

The baseline five cloud tables are deployed. Applying
`20261008180114_billing_foundation.sql` failed with the connector error
`Invalid or expired requestState`. A subsequent catalog read returned no
`billing_%` tables. The Edge Functions list was empty. This migration and these
functions are therefore NOT deployed; the error was not a PostgreSQL rejection.

## Deployment order

1. Restore a working Supabase management connection and apply the billing migration
   to project `nzxtdrmdvqyvcbohplzt`. Verify its three tables, RLS, grants and advisors.
2. Deploy `billing` and `stripe-webhook` with their shared modules. Both use
   `verify_jwt=false` intentionally: billing verifies the user's token with Auth
   and checks confirmed email plus active owner/admin membership; the webhook
   verifies Stripe's signature over the raw request body. Keep those checks intact.
3. Configure secrets through the hosting dashboard, never source control or chat.
   The runtime uses the platform's `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`
   and `SUPABASE_SECRET_KEYS` (JSON maps with a `default` key).
4. After handler deployment, register a sandbox Stripe webhook targeting
   `https://nzxtdrmdvqyvcbohplzt.supabase.co/functions/v1/stripe-webhook`.
   Subscribe to customer.subscription events, checkout.session.completed,
   checkout.session.async_payment_succeeded/failed, invoice.paid,
   invoice.payment_failed, invoice.payment_action_required, invoice.voided and
   invoice.marked_uncollectible. Copy the signing secret into the hosting secrets.
5. Approve price and tax behavior; create the EUR monthly recurring price under
   the approved product and activate that test product. Configure a Customer
   Portal allowing payment-method updates, invoice history and cancellation at
   period end. Avoid plan/quantity changes for this initial flow.
6. Supply the configuration below, finish paid PEP cloud UI, and run actual
   sandbox checkout, renewal, failure, cancellation and isolation scenarios before
   enabling booking. Finish the account release gates in cloud-foundation.md.

## Application configuration

- `STRIPE_RESTRICTED_KEY`: restricted sandbox key starting `rk_test_`. Live keys
  are deliberately rejected. Scope access to required customer, price, subscription,
  Checkout Session and billing portal operations.
- `STRIPE_WEBHOOK_SIGNING_SECRET`: endpoint signing secret (`whsec_…`).
- `STRIPE_PEP_PRICE_ID`: approved monthly EUR price. Never supplied by the browser.
- `STRIPE_PORTAL_CONFIGURATION_ID`: sandbox portal configuration (`bpc_…`).
- `BILLING_APP_ORIGIN`: `https://www.ladenfluss.de` by default; only the explicit
  allowed production origins or exact feature preview origin are accepted.
- `BILLING_CHECKOUT_ENABLED`: leave unset/false until all release gates pass.

SDK versions are pinned: Stripe 23.0.0 (API 2026-09-30.endive), Supabase JS 2.117.3.
Automatic tax and trials are not enabled. Agree tax treatment first; enable Stripe
Tax only after checking active registrations. This implementation supports sandbox
only; production billing requires a separately reviewed change.

## Security and consistency

The browser submits only action and company ID. Server-side membership and customer
mapping control access. Admin keys, customer ownership, prices and redirects cannot
be overridden by browser input. Billing tables have RLS and no client privileges.
Only the service role can execute the billing RPCs or write entitlements.

Per-company leases serialize checkout and webhook reconciliation. Stored checkout
attempts preserve idempotency across partial failures. Webhooks validate signature,
test mode and customer mapping, deduplicate event IDs, then fetch current Stripe
state while holding the lease. Snapshot and entitlement updates are atomic. Late
events cannot restore an old subscription state. Failures remain retryable.

Active access requires a paid invoice and future subscription item period; trials
require a future trial and item period. Paused collection, unpaid and expired
subscriptions do not grant access. Period-end cancellations retain access only
until the paid period ends. The database independently enforces entitlement expiry.

## Verification and limits

78 local tests pass: account and billing flows, real Stripe SDK signature checks,
UI states, and PostgreSQL/PGlite schema/RLS/lease/entitlement scenarios. Provider
responses are mocked; this is not an actual sandbox card payment. Deno type/import
checks pass for both Edge Function entrypoints. Browser CI must pass for the final
commit. Live email delivery, cross-device sessions, remote billing schema and
complete Stripe subscription lifecycle remain release gates.
