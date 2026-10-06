import 'package:flutter_test/flutter_test.dart';
import 'package:ladenfluss_wws/vacation_plan.dart';
import 'package:ladenfluss_wws/vacation_storage.dart';
import 'package:ladenfluss_wws/german_holidays.dart';

class MemoryVacationStorage implements VacationStorage {
  Map<String, dynamic>? payload;
  bool unreadable = false;
  final snapshots = <Map<String, dynamic>>[];

  @override
  Future<Map<String, dynamic>?> read() async {
    if (unreadable) throw const FormatException('Testdatei beschädigt');
    return payload;
  }

  @override
  Future<void> write(Map<String, dynamic> value) async {
    snapshots.add(value);
    payload = value;
  }
}

VacationEntry vacation(String id, String person, int startDay, int endDay, {
  LeaveStatus status = LeaveStatus.planned,
}) => VacationEntry(
  id: id, employeeId: person,
  start: DateTime(2026, 10, startDay, 12),
  end: DateTime(2026, 10, endDay, 12),
  status: status,
);

void main() {
  test('Fünf Tage Mo-Fr und sechs Tage Mo-Sa zählen richtig', () async {
    final p = VacationPlan(storage: MemoryVacationStorage());
    await p.load();
    final entry = vacation('v1', 'e1', 5, 10); // Monday to Saturday
    expect(p.workingDays(entry), 5);
    p.changeSettings(days: 6, maximum: 1);
    expect(p.workingDays(entry), 6);
    await p.pendingSave;
    p.dispose();
  });

  test('Urlaubstage werden dem richtigen Kalenderjahr zugeordnet', () async {
    final p = VacationPlan(storage: MemoryVacationStorage());
    await p.load();
    final employee = VacationEmployee(id: 'e1', name: 'Anna', annualDays: 30);
    p.employees.add(employee);
    p.upsert(VacationEntry(
      id: 'v1', employeeId: 'e1',
      start: DateTime(2026, 12, 28),
      end: DateTime(2027, 1, 5),
      status: LeaveStatus.approved,
    ));
    expect(p.usedDays('e1', 2026), 4);
    expect(p.usedDays('e1', 2027), 2); // 1 January is a holiday
    await p.pendingSave;
    p.dispose();
  });

  test('Bundeslandfeiertage werden vom Urlaub abgezogen', () async {
    final p = VacationPlan(storage: MemoryVacationStorage());
    await p.load();
    final entry = VacationEntry(
      id: 'holiday', employeeId: 'e1',
      start: DateTime(2026, 6, 4), end: DateTime(2026, 6, 4),
      status: LeaveStatus.planned,
    );
    expect(GermanHolidays.isHoliday(DateTime(2026, 6, 4), 'HE'), true);
    expect(p.workingDays(entry), 0);
    p.changeSettings(days: 5, maximum: 1, bundesland: 'BE');
    expect(p.workingDays(entry), 1);
    await p.pendingSave;
    p.dispose();
  });

  test('Doppelter Urlaub derselben Person wird abgelehnt', () async {
    final p = VacationPlan(storage: MemoryVacationStorage());
    await p.load();
    p.employees.add(const VacationEmployee(id: 'e1', name: 'Anna', annualDays: 30));
    p.upsert(vacation('a', 'e1', 5, 9));
    expect(() => p.upsert(vacation('b', 'e1', 8, 12)), throwsStateError);
    await p.pendingSave;
    p.dispose();
  });

  test('Überschneidungswarnung ist eine Planungshilfe, keine Sperre', () async {
    final p = VacationPlan(storage: MemoryVacationStorage());
    await p.load();
    p.employees.addAll(const [
      VacationEmployee(id: 'e1', name: 'Anna', annualDays: 30),
      VacationEmployee(id: 'e2', name: 'Ben', annualDays: 30),
    ]);
    p.upsert(vacation('a', 'e1', 5, 9));
    final second = vacation('b', 'e2', 7, 10);
    expect(p.capacityWarnings(second).length, 3);
    p.upsert(second);
    expect(p.entries.length, 2);
    await p.pendingSave;
    p.dispose();
  });

  test('Neustart liest die gespeicherten Einträge wieder ein', () async {
    final storage = MemoryVacationStorage();
    final first = VacationPlan(storage: storage);
    await first.load();
    first.addEmployee('Anna', 28);
    await first.pendingSave;
    final id = first.employees.single.id;
    first.upsert(vacation('v1', id, 5, 9));
    await first.pendingSave;
    first.dispose();

    final second = VacationPlan(storage: storage);
    await second.load();
    expect(second.employees.single.annualDays, 28);
    expect(second.usedDays(id, 2026), 5);
    second.dispose();
  });

  test('Fehlerhafte gespeicherte Daten sperren weitere Änderungen', () async {
    final storage = MemoryVacationStorage()..unreadable = true;
    final p = VacationPlan(storage: storage);
    await p.load();
    expect(p.canEdit, false);
    expect(p.storageError, isNotNull);
    expect(() => p.addEmployee('Test', 30), throwsStateError);
    await p.pendingSave;
    expect(storage.snapshots, isEmpty);
    p.dispose();
  });
}
