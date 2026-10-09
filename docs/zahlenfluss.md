# Zahlenfluss: first local workflow

Route: `/zahlenfluss`, linked from Mein Laden. No paid entitlement or cloud session
is required. No subscription or pricing promise is introduced.

- One net daily revenue entry per date, optional goods sold at cost, labor cost,
  other allocated costs, hours and receipt count.
- Blank means unknown; explicit zero remains zero. Revenue and money are stored as
  integer cents, hours as hundredths, receipt counts as whole units scaled by 100.
- Monday–Sunday overview, explicit day coverage, editable shared weekly revenue goal.
- Previous-week percentage uses only matching weekdays with entries in both weeks.
  A zero previous baseline has no percentage result.
- Hourly revenue and average receipt use only revenue from days with the respective
  denominator entered. Zero total denominator produces no ratio.
- Contribution is shown only when every recorded day has all three cost fields.
  This is neither accounting profit nor cash flow; partial week coverage stays visible.
- Local storage `ladenfluss.zahlenfluss.v1`, CSV/JSON download and inclusion in the
  existing workspace backup. Existing days require explicit edit, with stale-edit
  protection. Save errors retain the input; malformed storage is never reset silently.

Limitations: no negative daily revenue, CSV import, multi-company selector,
monthly view, cloud synchronization, invoicing or accounting integration yet.
The weekly target is shared across all viewed weeks, not historical per-week targets.
No sample business data is injected on opening the page.

Validation: five domain tests cover cents and invalid input, missing costs and
weighted ratios, comparable weekdays, corrupt storage/quota errors and CSV blanks.
A mobile browser flow covers create/edit/reload/duplicate rejection/target and overflow.

JSON backup restoration is now available with a reviewed replacement preview; see restore.md.
