/// German public holiday dates used for planning, not a legal entitlement engine.
/// Municipal exceptions (e.g. parts of Bavaria) are intentionally not included.
class GermanHolidays {
  static const states = <String, String>{
    'BW': 'Baden-Württemberg', 'BY': 'Bayern', 'BE': 'Berlin',
    'BB': 'Brandenburg', 'HB': 'Bremen', 'HH': 'Hamburg',
    'HE': 'Hessen', 'MV': 'Mecklenburg-Vorpommern',
    'NI': 'Niedersachsen', 'NW': 'Nordrhein-Westfalen',
    'RP': 'Rheinland-Pfalz', 'SL': 'Saarland',
    'SN': 'Sachsen', 'ST': 'Sachsen-Anhalt',
    'SH': 'Schleswig-Holstein', 'TH': 'Thüringen',
  };

  static DateTime easter(int year) {
    final a = year % 19, b = year ~/ 100, c = year % 100;
    final d = b ~/ 4, e = b % 4;
    final f = (b + 8) ~/ 25, g = (b - f + 1) ~/ 3;
    final h = (19 * a + b - d - g + 15) % 30;
    final i = c ~/ 4, k = c % 4;
    final l = (32 + 2 * e + 2 * i - h - k) % 7;
    final m = (a + 11 * h + 22 * l) ~/ 451;
    final month = (h + l - 7 * m + 114) ~/ 31;
    final day = ((h + l - 7 * m + 114) % 31) + 1;
    return DateTime(year, month, day, 12);
  }

  static DateTime shifted(DateTime d, int count) =>
      DateTime(d.year, d.month, d.day + count, 12);

  static bool sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  static bool matches(DateTime date, int month, int day) =>
      date.month == month && date.day == day;

  static bool isHoliday(DateTime date, String state) {
    if (!states.containsKey(state)) return false;
    final easterDay = easter(date.year);
    if (matches(date, 1, 1) || matches(date, 5, 1) ||
        matches(date, 10, 3) || matches(date, 12, 25) ||
        matches(date, 12, 26) ||
        sameDay(date, shifted(easterDay, -2)) ||
        sameDay(date, shifted(easterDay, 1)) ||
        sameDay(date, shifted(easterDay, 39)) ||
        sameDay(date, shifted(easterDay, 50))) return true;

    if (matches(date, 1, 6) && const {'BW','BY','ST'}.contains(state)) return true;
    if (matches(date, 3, 8) && const {'BE','MV'}.contains(state)) return true;
    if (sameDay(date, shifted(easterDay, 60)) &&
        const {'BW','BY','HE','NW','RP','SL'}.contains(state)) return true;
    if (matches(date, 8, 15) && state == 'SL') return true;
    if (matches(date, 9, 20) && state == 'TH') return true;
    if (matches(date, 10, 31) &&
        const {'BB','HB','HH','MV','NI','SN','ST','SH','TH'}.contains(state)) return true;
    if (matches(date, 11, 1) &&
        const {'BW','BY','NW','RP','SL'}.contains(state)) return true;
    return false;
  }
}
