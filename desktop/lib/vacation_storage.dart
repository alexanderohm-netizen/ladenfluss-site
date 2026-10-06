import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Separate local vacation file; not shared with the public browser tool.
abstract class VacationStorage {
  Future<Map<String, dynamic>?> read();
  Future<void> write(Map<String, dynamic> payload);
}

/// Demo storage, not encrypted or suitable for real employee data without access controls.
class LocalVacationStorage implements VacationStorage {
  Future<File> get _file async {
    final dir = await getApplicationSupportDirectory();
    final folder = Directory('${dir.path}${Platform.pathSeparator}ladenfluss_wws');
    if (!await folder.exists()) await folder.create(recursive: true);
    return File('${folder.path}${Platform.pathSeparator}vacations-v1.json');
  }

  @override
  Future<Map<String, dynamic>?> read() async {
    final file = await _file;
    if (await file.exists()) return _parse(file);
    final backup = File('${file.path}.bak');
    if (await backup.exists()) return _parse(backup);
    return null;
  }

  Future<Map<String, dynamic>> _parse(File file) async {
    final value = jsonDecode(await file.readAsString());
    if (value is! Map<String, dynamic> || value['version'] != 1) {
      throw const FormatException('Unbekanntes Urlaubsplaner-Format');
    }
    return value;
  }

  @override
  Future<void> write(Map<String, dynamic> payload) async {
    final file = await _file;
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(jsonEncode(payload), flush: true);
    if (await file.exists()) {
      final backup = File('${file.path}.bak');
      if (await backup.exists()) await backup.delete();
      await file.rename(backup.path);
      try {
        await temp.rename(file.path);
      } catch (_) {
        await backup.rename(file.path);
        rethrow;
      }
    } else {
      await temp.rename(file.path);
    }
  }
}
