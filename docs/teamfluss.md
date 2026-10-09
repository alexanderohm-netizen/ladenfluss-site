# Teamfluss and shared workspace navigation

Step 1 of the agreed integration plan. `/teamfluss` is a read-only entry point for
existing employee, weekly shift, absence and vacation data. It never seeds defaults,
migrates records or writes storage. Existing planning pages retain their workflows.

The selected date shows the team, scheduled people excluding recorded absences,
explicit conflicts and approved vacations matched by employee ID. Unmatched leave is
flagged rather than assigned by name. Missing weeks are unknown, not empty coverage.
An old legacy plan asks users to open the existing planner for migration. Recognizable
sample employees are labelled as possible demo data. Corrupt records fail closed.

Coverage signals reuse the existing planning engine only when both a saved shop
profile and selected weekly plan exist. Pause timing remains unknown. This dashboard
is a planning overview, not attendance tracking, payroll or a personnel file system.

Shared server-rendered navigation on Mein Laden, Zahlenfluss, Warenfluss, Teamfluss,
employees, PEP and vacation: Mein Laden / Zahlenfluss / Warenfluss / Teamfluss / Rechner.
Team pages add overview / employees / roster / vacation. Links work without JavaScript;
mobile navigation wraps instead of hiding modules in a menu.

Tests cover no initial writes, absence/shift conflict data, preserved damaged storage
and mobile navigation/dated plan links. Cloud, backup restoration, monthly analyses
and purchasing workflows remain subsequent steps.
