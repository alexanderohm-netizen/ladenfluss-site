# Module backup restoration

Zahlenfluss and Warenfluss accept their native JSON export or extract their exact key
from a version-1 Ladenfluss workspace backup. No other key, including credentials,
team data or other modules, is written. Workspace-wide restoration is not implemented.

Flow: choose file -> validate -> inspect before/after summary -> optional download of
the exact previous value -> explicitly confirm replacement -> write one storage key ->
reload. Existing and incoming datasets are not merged. Unsaved form input is discarded
on reload, as explained in the preview. Cancel performs no writes. File selection is
limited to 5 MB. Unknown versions, wrong modules, bad references and invalid balances
are rejected; accepted data is copied into known schema fields only.

Restoration performs one localStorage.setItem, so a quota failure leaves the previous
value intact. A stale preview cannot replace changes observed since preparation.
Another tab's storage event invalidates the preview. As with all localStorage apps,
this is not a cross-process database transaction or collaborative editing protocol.
Warenfluss restore is capped at 2,000 articles and 20,000 movements for the local UI.

A corrupt existing value can be downloaded and replaced using a valid backup. Restore
controls mount after the host app, keeping recovery available when that app disables
its normal editing controls because of corrupt data. Success reloads the host app and
shows a one-time non-sensitive session notice. File contents stay in the browser.

Tests cover exact cents, schema field projection, isolated extraction from workspace
backups, unsupported/oversize files, stale writes, quota failure, corrupted existing
values, inventory integrity and browser preview/cancel/confirm/reload/recovery flows.

Next: restore the coupled team/shift/vacation/profile dataset through a separately
validated flow; it must not introduce partial references or silently merge identities.
