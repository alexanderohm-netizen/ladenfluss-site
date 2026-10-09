# Coupled Teamfluss restore

The Teamfluss page restores team, dated weekly shifts, legacy shifts, plan states,
absences and vacation from a version-1 workspace JSON backup. Profile/targets, numbers,
inventory, calculation history and credentials are never included in the write.

The existing preview/explicit confirmation flow shows employee/week/leave counts and
independent vacation identities. Missing selected records become empty, not merged with
old data. The UI explicitly states this and asks users to close other Ladenfluss tabs.
Prior logical data can be downloaded as a workspace backup before confirmation.

Validation checks unique safe employee IDs, field types/bounds, seven-day shift and
absence rows, Monday week keys, existing employee references, valid shift times/breaks,
plan state references and the existing vacation validator. The same employee ID with
different normalized names across team/vacation is rejected. Different IDs are never
merged by name; independent vacation people remain independent and are counted in preview.
Legacy-only shifts with no week date are rejected with migration instructions.

## Atomic storage compatibility

localStorage has no multi-key transaction. Restoration therefore writes one validated
`ladenfluss.team-bundle.v1` envelope containing the six logical records. Quota failure
leaves all old data intact. The team-storage adapter uses the envelope when present and
falls back to original keys otherwise. Team, planning, vacation, overview and backup
readers/writers now use this adapter. Individual edits update their logical record in
the envelope; exports still emit the original portable workspace format.

Original physical keys remain as older values and are shadowed by the envelope; they
are not current data after restoration. Do not downgrade to a bundle-unaware frontend
without first exporting the logical data. All current entry pages load the adapter
before their data stores. No automatic conversion happens merely by opening a page.
A malformed envelope fails closed instead of generating example data.

A preview fingerprint covers the bundle and original keys. Any detected edit invalidates
the preview; storage events invalidate UI confirmation. This does not implement live
collaborative editing: users must reload other tabs after restore, especially older
already-open application versions. No multi-key write loop or partial rollback is used.

Limits: 5 MB file, 2,000 team people, 1,000 weeks per planning map, 2,000 vacation
people and 10,000 leave entries. Profile restoration remains a separate future feature.

Tests cover all readers and future writes/exports, stale changes, one-write quota
failure, invalid references/identity mismatch, independent vacation people, ambiguous
legacy dates, malformed bundles, and browser restore -> team edit -> PEP -> vacation
-> workspace backup continuity.
