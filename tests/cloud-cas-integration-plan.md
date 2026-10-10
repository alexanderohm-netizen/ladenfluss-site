# Cloud CAS integration test checklist

These tests are **not executed**. Run only against a disposable Supabase test project or branch with no real customer data.

## Setup
- Create two confirmed Auth users (A and B), each owning a separate company.
- Use actual Supabase client JWTs (never service-role JWTs) for all access tests.
- Apply the revision guard and RPC draft migrations after review.
- Confirm `authenticated` retains SELECT-only table grants.
- Do not expose the service-role key to browsers.

## Test cases

| Case | Action | Expected |
|---|---|---|
| Initial state | Server-side seed company A/profile document at revision 1 | Revision 1 readable to A |
| Successful save | A calls save_cloud_document_if_revision(expected=1) | Revision 2, payload updated, history contains revision 1 |
| Stale save | A calls save_cloud_document_if_revision(expected=1) again | SQLSTATE 40001, revision 2 unchanged |
| Concurrent writes | Two A sessions save from revision 2 simultaneously | Exactly one success, one conflict |
| Foreign tenant | B calls RPC against A's company ID | SQLSTATE 42501, no mutation |
| Unconfirmed account | Unconfirmed user calls RPC | Rejected |
| Invalid payload | A passes array or >1 MiB object | Rejected |
| Direct UPDATE | A tries client table UPDATE | Permission denied |
| Revision skip | privileged staging-only update 2 -> 4 | Trigger rejects |
| Same revision | privileged staging-only payload change without revision increase | Trigger rejects |
| Identity mutation | privileged staging-only change of company_id | Trigger rejects |
| History | After save, inspect old revision and retention | Previous revision preserved exactly once |

## Critical implementation checks
1. `public.save_cloud_document_if_revision` is SECURITY DEFINER; review its owner, grants, and search_path before enabling.
2. `private.guard_cloud_document_revision` must not block intended maintenance operations without an approved bypass plan.
3. Direct client INSERT is not granted; first-write provisioning needs its own guarded creation RPC.
4. If the UI allows offline editing, retain local drafts on conflicts and never silently overwrite.
5. After staging success, run the same test matrix against production using dedicated test identities only after explicit approval.

## Result
Not run: no isolated Supabase branch exists as of 2026-10-10. Branch creation requires a separate cost confirmation.
