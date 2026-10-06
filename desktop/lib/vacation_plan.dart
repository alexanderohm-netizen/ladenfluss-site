import 'package:flutter/foundation.dart';
import 'vacation_storage.dart';

enum LeaveStatus { planned, approved }

class VacationEmployee {
  const VacationEmployee({
    required this.id, required this.name, required this.annualDays,
  });
  final String id;
  final String name;
  final int annualDays;
}

class VacationEntry {
  const VacationEntry({
    required this.id, required this.employeeId, required this.start,
    required this.end, required this.status, this.note = '',
  });
  final String id;
  final String employeeId;
  final DateTime start;
  final DateTime end;
  final LeaveStatus status;
  final String note;
}

class VacationPlan extends ChangeNotifier {
  VacationPlan({VacationStorage? storage})
      : _storage = storage ?? LocalVacationStorage();

  final VacationStorage _storage;
  final employees = <VacationEmployee>[];
  final entries = <VacationEntry>[];
  Future<void> _saveTail = Future<void>.value();
  bool loaded = false;
  bool loadFailed = false;
  bool _disposed = false;
  String? storageError;
  int workweekDays = 5;
  int maxAbsent = 1;

  bool get canEdit => loaded && !loadFailed;
  Future<void> get pendingSave => _saveTail;

  void _changed() { if (!_disposed) notifyListeners(); }

  Future<void> load() async {
    if (loaded) return;
    try {
      final data = await _storage.read();
      if (data != null) {
        final restoredEmployees = (data['employees'] as List).map((raw) {
          final item = raw as Map<String, dynamic>;
          return VacationEmployee(
            id: item['id'] as String, name: item['name'] as String,
            annualDays: item['annualDays'] as int,
          );
        }).toList();
        final restoredEntries = (data['entries'] as List).map((raw) {
          final item = raw as Map<String, dynamic>;
          return VacationEntry(
            id: item['id'] as String,
            employeeId: item['employeeId'] as String,
            start: DateTime.parse(item['start'] as String),
            end: DateTime.parse(item['end'] as String),
            status: LeaveStatus.values.byName(item['status'] as String),
            note: item['note'] as String? ?? '',
          );
        }).toList();
        final days = data['workweekDays'] as int;
        final maximum = data['maxAbsent'] as int;
        if (days != 5 && days != 6) throw const FormatException('Ungültige Arbeitswoche');
        if (maximum < 1) throw const FormatException('Ungültige Teamgrenze');
        employees..clear()..addAll(restoredEmployees);
        entries..clear()..addAll(restoredEntries);
        workweekDays = days;
        maxAbsent = maximum;
      }
      storageError = null;
      loadFailed = false;
    } catch (error) {
      loadFailed = true;
      storageError = 'Gespeicherter Urlaubsplan konnte nicht geladen werden. Bearbeitung gesperrt: $error';
    } finally {
      loaded = true;
      _changed();
    }
  }

  Future<void> save() {
    if (!canEdit) return Future<void>.value();
    // Snapshot is built synchronously so consecutive writes cannot overtake.
    final snapshot = <String, dynamic>{
      'version': 1,
      'workweekDays': workweekDays,
      'maxAbsent': maxAbsent,
      'employees': [
        for (final e in employees)
          {'id': e.id, 'name': e.name, 'annualDays': e.annualDays},
      ],
      'entries': [
        for (final e in entries)
          {
            'id': e.id, 'employeeId': e.employeeId,
            'start': _iso(e.start), 'end': _iso(e.end),
            'status': e.status.name, 'note': e.note,
          },
      ],
    };
    _saveTail = _saveTail.then((_) async {
      try {
        await _storage.write(snapshot);
        storageError = null;
      } catch (error) {
        storageError = 'Speichern fehlgeschlagen: $error';
      }
      _changed();
    });
    return _saveTail;
  }

  void _editable() {
    if (!canEdit) throw StateError('Urlaubsplan wird geladen oder ist geschützt.');
  }

  static String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static DateTime _date(DateTime d) => DateTime(d.year, d.month, d.day, 12);

  bool isWorkday(DateTime day) =>
      day.weekday <= (workweekDays == 6 ? DateTime.saturday : DateTime.friday);

  Iterable<DateTime> datesOf(VacationEntry entry) sync* {
    var day = _date(entry.start);
    final last = _date(entry.end);
    if (last.isBefore(day) || last.difference(day).inDays > 370) {
      throw StateError('Der Zeitraum ist ungültig oder länger als ein Jahr.');
    }
    while (!day.isAfter(last)) {
      yield day;
      day = DateTime(day.year, day.month, day.day + 1, 12);
    }
  }

  int workingDays(VacationEntry entry, {int? year}) =>
      datesOf(entry).where((d) => isWorkday(d) &&
          (year == null || d.year == year)).length;

  int usedDays(String employeeId, int year) => entries
      .where((e) => e.employeeId == employeeId)
      .fold(0, (sum, e) => sum + workingDays(e, year: year));

  bool overlaps(VacationEntry a, VacationEntry b) =>
      !_date(a.start).isAfter(_date(b.end)) && !_date(b.start).isAfter(_date(a.end));

  bool overlapsEmployee(VacationEntry candidate) =>
      entries.any((e) => e.id != candidate.id &&
          e.employeeId == candidate.employeeId && overlaps(e, candidate));

  List<DateTime> capacityWarnings(VacationEntry candidate) {
    final combined = entries.where((e) => e.id != candidate.id).toList()
      ..add(candidate);
    return datesOf(candidate).where((d) {
      if (!isWorkday(d)) return false;
      final people = combined.where((e) =>
          !d.isBefore(_date(e.start)) && !d.isAfter(_date(e.end)))
          .map((e) => e.employeeId).toSet();
      return people.length > maxAbsent;
    }).toList();
  }

  void addEmployee(String name, int annualDays) {
    _editable();
    if (name.trim().isEmpty || annualDays < 0 || annualDays > 366) {
      throw StateError('Name und gültige Urlaubstage eingeben.');
    }
    employees.add(VacationEmployee(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      name: name.trim(), annualDays: annualDays,
    ));
    _changed(); save();
  }

  void updateAnnualDays(String id, int annualDays) {
    _editable();
    if (annualDays < 0 || annualDays > 366) throw StateError('Ungültiges Urlaubsbudget.');
    final index = employees.indexWhere((e) => e.id == id);
    if (index < 0) throw StateError('Mitarbeiter nicht gefunden.');
    final old = employees[index];
    employees[index] = VacationEmployee(
      id: old.id, name: old.name, annualDays: annualDays,
    );
    _changed(); save();
  }

  void removeEmployee(String id) {
    _editable();
    if (entries.any((e) => e.employeeId == id)) {
      throw StateError('Bitte zuerst die Urlaubszeiträume dieser Person löschen.');
    }
    employees.removeWhere((e) => e.id == id);
    _changed(); save();
  }

  void changeSettings({required int days, required int maximum}) {
    _editable();
    if ((days != 5 && days != 6) || maximum < 1 || maximum > 100) {
      throw StateError('Ungültige Einstellungen.');
    }
    workweekDays = days;
    maxAbsent = maximum;
    _changed(); save();
  }

  void upsert(VacationEntry entry) {
    _editable();
    if (!employees.any((e) => e.id == entry.employeeId)) {
      throw StateError('Mitarbeiter nicht gefunden.');
    }
    if (_date(entry.start).isAfter(_date(entry.end))) throw StateError('Ende liegt vor Beginn.');
    workingDays(entry); // validates range
    if (overlapsEmployee(entry)) {
      throw StateError('Diese Person hat bereits Urlaub im gewählten Zeitraum.');
    }
    final index = entries.indexWhere((e) => e.id == entry.id);
    if (index < 0) { entries.add(entry); } else { entries[index] = entry; }
    _changed(); save();
  }

  void removeEntry(String id) {
    _editable();
    entries.removeWhere((e) => e.id == id);
    _changed(); save();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
