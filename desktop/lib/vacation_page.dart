import 'package:flutter/material.dart';
import 'vacation_plan.dart';
import 'german_holidays.dart';

class VacationPage extends StatefulWidget {
  const VacationPage({super.key, required this.plan});
  final VacationPlan plan;
  @override
  State<VacationPage> createState() => _VacationPageState();
}

class _VacationPageState extends State<VacationPage> {
  late DateTime month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    month = DateTime(now.year, now.month, 1, 12);
  }

  String dateText(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}';

  void message(String text) {
    if (mounted) ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> addEmployee() async {
    if (!widget.plan.canEdit) return;
    final name = TextEditingController();
    final allowance = TextEditingController(text: '30');
    final form = GlobalKey<FormState>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mitarbeiter hinzufügen'),
        content: SizedBox(width: 380, child: Form(
          key: form,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
              validator: (text) => text == null || text.trim().isEmpty ? 'Name fehlt' : null,
            ),
            TextFormField(
              controller: allowance,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Urlaubstage pro Jahr'),
              validator: (text) {
                final number = int.tryParse(text ?? '');
                return number == null || number < 0 || number > 366
                    ? 'Bitte 0 bis 366 Tage eingeben' : null;
              },
            ),
          ]),
        )),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Abbrechen')),
          FilledButton(onPressed: () {
            if (form.currentState!.validate()) Navigator.pop(context, true);
          }, child: const Text('Anlegen')),
        ],
      ),
    );
    if (confirmed == true) {
      try { widget.plan.addEmployee(name.text, int.parse(allowance.text)); }
      on StateError catch (e) { message(e.message); }
    }
    name.dispose();
    allowance.dispose();
  }

  Future<void> editAllowance(VacationEmployee employee) async {
    final input = TextEditingController(text: employee.annualDays.toString());
    final days = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Urlaubsbudget · ${employee.name}'),
        content: SizedBox(width: 330, child: TextField(
          controller: input,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Urlaubstage pro Jahr'),
        )),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Abbrechen')),
          FilledButton(onPressed: () {
            final value = int.tryParse(input.text);
            if (value == null || value < 0 || value > 366) return;
            Navigator.pop(context, value);
          }, child: const Text('Speichern')),
        ],
      ),
    );
    input.dispose();
    if (days != null) {
      try { widget.plan.updateAnnualDays(employee.id, days); }
      on StateError catch (e) { message(e.message); }
    }
  }

  Future<void> editLeave([VacationEntry? initial]) async {
    if (!widget.plan.canEdit) return;
    if (widget.plan.employees.isEmpty) {
      message('Bitte zuerst einen Mitarbeiter anlegen.');
      return;
    }
    String employeeId = initial?.employeeId ?? widget.plan.employees.first.id;
    LeaveStatus status = initial?.status ?? LeaveStatus.planned;
    DateTimeRange range = DateTimeRange(
      start: initial?.start ?? DateTime.now(),
      end: initial?.end ?? DateTime.now(),
    );
    final note = TextEditingController(text: initial?.note ?? '');
    final result = await showDialog<VacationEntry>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: Text(initial == null ? 'Urlaub eintragen' : 'Urlaub bearbeiten'),
          content: SizedBox(width: 420, child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                value: employeeId,
                decoration: const InputDecoration(labelText: 'Mitarbeiter'),
                items: [
                  for (final employee in widget.plan.employees)
                    DropdownMenuItem(value: employee.id, child: Text(employee.name)),
                ],
                onChanged: (id) { if (id != null) update(() => employeeId = id); },
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () async {
                  final chosen = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                    initialDateRange: range,
                    helpText: 'Urlaubszeitraum auswählen',
                    saveText: 'Übernehmen',
                  );
                  if (chosen != null) update(() => range = chosen);
                },
                icon: const Icon(Icons.date_range_outlined),
                label: Text('${dateText(range.start)} – ${dateText(range.end)}'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<LeaveStatus>(
                value: status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(value: LeaveStatus.planned, child: Text('Geplant')),
                  DropdownMenuItem(value: LeaveStatus.approved, child: Text('Bestätigt')),
                ],
                onChanged: (next) { if (next != null) update(() => status = next); },
              ),
              TextField(
                controller: note,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Notiz (optional)'),
              ),
              Text(
                '${widget.plan.workingDays(VacationEntry(id: initial?.id ?? '', employeeId: employeeId, start: range.start, end: range.end, status: status))} Arbeitstage · Feiertage derzeit nicht berücksichtigt',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ]),
          )),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Abbrechen')),
            FilledButton(onPressed: () {
              final entry = VacationEntry(
                id: initial?.id ?? DateTime.now().microsecondsSinceEpoch.toString(),
                employeeId: employeeId,
                start: DateTime(range.start.year, range.start.month, range.start.day, 12),
                end: DateTime(range.end.year, range.end.month, range.end.day, 12),
                status: status,
                note: note.text.trim(),
              );
              if (widget.plan.overlapsEmployee(entry)) {
                message('Diese Person hat in diesem Zeitraum schon einen Urlaubseintrag.');
                return;
              }
              Navigator.pop(context, entry);
            }, child: const Text('Speichern')),
          ],
        ),
      ),
    );
    note.dispose();
    if (result == null || !mounted) return;
    final conflictDays = widget.plan.capacityWarnings(result);
    if (conflictDays.isNotEmpty) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Urlaubsüberschneidung'),
          content: Text(
            'An ${conflictDays.length} Arbeitstagen sind mehr Personen gleichzeitig '
            'im Urlaub als geplant. Trotzdem eintragen?',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Zurück')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Trotzdem speichern')),
          ],
        ),
      );
      if (proceed != true) return;
    }
    try {
      widget.plan.upsert(result);
      setState(() => month = DateTime(result.start.year, result.start.month, 1, 12));
      message('Urlaubseintrag gespeichert.');
    } on StateError catch (e) { message(e.message); }
  }

  String employeeName(String id) {
    for (final e in widget.plan.employees) {
      if (e.id == id) return e.name;
    }
    return 'Unbekannte Person';
  }

  Widget _calendar() {
    final first = DateTime(month.year, month.month, 1, 12);
    final start = DateTime(first.year, first.month, first.day - (first.weekday - 1), 12);
    final today = DateTime.now();
    final cells = <Widget>[];
    for (final day in ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      cells.add(Center(child: Text(day, style: const TextStyle(fontWeight: FontWeight.bold))));
    }
    for (var i = 0; i < 42; i++) {
      final date = DateTime(start.year, start.month, start.day + i, 12);
      final entries = widget.plan.entries.where((e) =>
          !date.isBefore(DateTime(e.start.year, e.start.month, e.start.day, 12)) &&
          !date.isAfter(DateTime(e.end.year, e.end.month, e.end.day, 12))).toList();
      final uniquePeople = entries.map((e) => e.employeeId).toSet();
      final warning = widget.plan.isWorkday(date) &&
          uniquePeople.length > widget.plan.maxAbsent;
      final isToday = date.year == today.year &&
          date.month == today.month && date.day == today.day;
      cells.add(Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: warning ? const Color(0xFFFFF0EC) :
              date.month != month.month ? const Color(0xFFF4F1F0) : Colors.white,
          border: Border.all(color: isToday ? const Color(0xFF752D43) : const Color(0xFFE6E1E1)),
          borderRadius: BorderRadius.circular(7),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${date.day}', style: TextStyle(
            color: date.month == month.month ? const Color(0xFF55434A) : Colors.grey,
            fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
          )),
          for (final e in entries.take(2))
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 2),
              margin: const EdgeInsets.only(top: 3),
              decoration: BoxDecoration(
                color: e.status == LeaveStatus.approved ?
                    const Color(0xFF752D43) : const Color(0xFFF3D8E0),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(employeeName(e.employeeId),
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10,
                  color: e.status == LeaveStatus.approved ? Colors.white : const Color(0xFF752D43))),
            ),
          if (entries.length > 2) Text('+${entries.length - 2}', style: const TextStyle(fontSize: 10)),
        ]),
      ));
    }
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 7,
      mainAxisSpacing: 4,
      crossAxisSpacing: 4,
      childAspectRatio: .94,
      children: cells,
    );
  }

  @override
  Widget build(BuildContext context) => Expanded(
    child: AnimatedBuilder(
      animation: widget.plan,
      builder: (context, _) {
        final plan = widget.plan;
        final thisYear = month.year;
        final yearEntries = plan.entries.where((e) =>
            e.start.year <= thisYear && e.end.year >= thisYear).toList()
          ..sort((a, b) => a.start.compareTo(b.start));
        return SingleChildScrollView(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text('Urlaubsplaner · kostenlos', style: Theme.of(context).textTheme.titleLarge)),
              OutlinedButton.icon(onPressed: plan.canEdit ? addEmployee : null,
                icon: const Icon(Icons.person_add_alt_outlined), label: const Text('Mitarbeiter')),
              const SizedBox(width: 10),
              FilledButton.icon(onPressed: plan.canEdit ? () => editLeave() : null,
                icon: const Icon(Icons.add), label: const Text('Urlaub eintragen')),
            ]),
            const SizedBox(height: 12),
            const Text('Lokaler Prototyp: Keine Synchronisierung mit der Website, keine Freigabe-Workflows und keine Cloud-Speicherung.'),
            if (plan.storageError != null) Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(plan.storageError!, style: const TextStyle(color: Colors.red)),
            ),
            const SizedBox(height: 16),
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  IconButton(tooltip: 'Vorheriger Monat', onPressed: () =>
                    setState(() => month = DateTime(month.year, month.month - 1, 1, 12)),
                    icon: const Icon(Icons.chevron_left)),
                  Text('${month.month.toString().padLeft(2, '0')} / ${month.year}',
                    style: Theme.of(context).textTheme.titleLarge),
                  IconButton(tooltip: 'Nächster Monat', onPressed: () =>
                    setState(() => month = DateTime(month.year, month.month + 1, 1, 12)),
                    icon: const Icon(Icons.chevron_right)),
                  const Spacer(),
                  TextButton(onPressed: () {
                    final now = DateTime.now();
                    setState(() => month = DateTime(now.year, now.month, 1, 12));
                  }, child: const Text('Heute')),
                ]),
                const SizedBox(height: 8),
                _calendar(),
              ]),
            )),
            const SizedBox(height: 12),
            Wrap(spacing: 18, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: [
              const Text('Bundesland:'),
              DropdownButton<String>(
                value: plan.state,
                items: [
                  for (final entry in GermanHolidays.states.entries)
                    DropdownMenuItem(value: entry.key, child: Text(entry.value)),
                ],
                onChanged: plan.canEdit ? (code) {
                  if (code != null) {
                    plan.changeSettings(days: plan.workweekDays,
                      maximum: plan.maxAbsent, bundesland: code);
                  }
                } : null,
              ),
              const Text('Arbeitstage je Woche:'),
              DropdownButton<int>(
                value: plan.workweekDays,
                items: const [
                  DropdownMenuItem(value: 5, child: Text('Mo–Fr (5 Tage)')),
                  DropdownMenuItem(value: 6, child: Text('Mo–Sa (6 Tage)')),
                ],
                onChanged: plan.canEdit ? (days) {
                  if (days != null) plan.changeSettings(days: days, maximum: plan.maxAbsent);
                } : null,
              ),
              const Text('Max. gleichzeitig abwesend:'),
              DropdownButton<int>(
                value: plan.maxAbsent,
                items: [for (var i = 1; i <= 100; i++) DropdownMenuItem(value: i, child: Text('$i'))],
                onChanged: plan.canEdit ? (maximum) {
                  if (maximum != null) plan.changeSettings(days: plan.workweekDays, maximum: maximum);
                } : null,
              ),
            ]),
            const SizedBox(height: 8),
            const Text('Feiertage nach Bundesland werden abgezogen. Lokale Sonderregeln und individuelle Dienstpläne sind noch nicht vollständig berücksichtigt.'),
            const SizedBox(height: 18),
            Text('Urlaubskonten $thisYear', style: Theme.of(context).textTheme.titleLarge),
            if (plan.employees.isEmpty) const ListTile(title: Text('Lege zuerst dein Team an.')),
            for (final employee in plan.employees)
              Card(child: ListTile(
                title: Text(employee.name),
                subtitle: Text('${plan.usedDays(employee.id, thisYear)} geplant oder bestätigt '
                    '· ${employee.annualDays} Tage Jahresbudget'),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('${employee.annualDays - plan.usedDays(employee.id, thisYear)} frei'),
                  IconButton(tooltip: 'Urlaubsbudget ändern', onPressed: plan.canEdit ?
                    () => editAllowance(employee) : null, icon: const Icon(Icons.edit_outlined)),
                  IconButton(tooltip: 'Mitarbeiter löschen', onPressed: plan.canEdit ? () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Mitarbeiter entfernen?'),
                        content: Text('Mitarbeiter ${employee.name} entfernen? Bestehende Einträge müssen vorher gelöscht werden.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Abbrechen')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Entfernen')),
                        ],
                      ),
                    );
                    if (confirm != true) return;
                    try { plan.removeEmployee(employee.id); }
                    on StateError catch (e) { message(e.message); }
                  } : null, icon: const Icon(Icons.delete_outline)),
                ]),
              )),
            const SizedBox(height: 14),
            Text('Urlaubseinträge $thisYear', style: Theme.of(context).textTheme.titleLarge),
            if (yearEntries.isEmpty) const ListTile(title: Text('Noch keine Urlaubseinträge für dieses Jahr.')),
            for (final entry in yearEntries)
              Card(child: ListTile(
                title: Text(employeeName(entry.employeeId)),
                subtitle: Text('${dateText(entry.start)} – ${dateText(entry.end)} '
                    '· ${plan.workingDays(entry, year: thisYear)} Arbeitstage'
                    ' · ${entry.status == LeaveStatus.approved ? 'Bestätigt' : 'Geplant'}'
                    '${entry.note.isEmpty ? '' : ' · ${entry.note}'}'),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  if (plan.capacityWarnings(entry).isNotEmpty)
                    const Tooltip(message: 'Zu viele gleichzeitige Abwesenheiten',
                      child: Icon(Icons.warning_amber_outlined, color: Colors.deepOrange)),
                  IconButton(tooltip: 'Bearbeiten', onPressed: plan.canEdit ?
                    () => editLeave(entry) : null, icon: const Icon(Icons.edit_outlined)),
                  IconButton(tooltip: 'Entfernen', onPressed: plan.canEdit ? () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Urlaubseintrag löschen?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Abbrechen')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Löschen')),
                        ],
                      ),
                    );
                    if (confirmed == true) plan.removeEntry(entry.id);
                  } : null, icon: const Icon(Icons.delete_outline)),
                ]),
              )),
          ],
        ));
      },
    ),
  );
}
