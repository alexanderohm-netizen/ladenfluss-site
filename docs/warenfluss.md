# Warenfluss — first local web workflow

Route `/warenfluss`, linked from Mein Laden. Stores data only in the current browser
under `ladenfluss.warenfluss.v1`; there is no backend, paid entitlement or sync.

Articles have a name, unique case-insensitive SKU, minimum stock in whole pieces and
archive state. Stock is derived from receipt, issue and correction movements. Every
movement has a UUID, article reference, signed quantity, timestamp and mandatory note.
Existing movements cannot be edited or removed through the UI; incorrect entries need
an opposite movement. This local log is not tamper-proof or an accounting audit trail.

Negative stock, fractional pieces, duplicate SKUs and bookings against archived items
are rejected. Only zero-stock articles can be archived; history is retained. All edits
are persisted before updating the UI; save failure retains input. Changed browser data
blocks stale writes until reload. Corrupt data is not silently reset.

Overview shows active articles, total pieces and articles at/below their own minimum.
No automatic order quantity, demand forecast or inventory value is claimed. Exports
include stock CSV (quoted and protected against spreadsheet formula prefixes) and full
JSON backup. Data is also included in the existing workspace backup.

Not yet included: CSV import, barcode scanning, batch/MHD tracking,
suppliers, purchase orders, locations, valuation, cloud/role integration. The existing
desktop inventory prototype is not changed or synchronized by this web version.

Validation: domain tests cover balance, overselling and invalid input, archive/history,
corrupt records and CSV formula escaping. Browser test covers mobile article creation,
receipt, rejected oversell, valid issue, reload, low-stock signal and overflow.

JSON backup restoration is now available with a reviewed replacement preview; see restore.md.
