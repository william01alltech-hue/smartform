import 'package:flutter/foundation.dart';

class Env {
  static String get serverBaseUrl {
    if (kIsWeb) {
      final origin = Uri.base.origin;
      if (origin.isNotEmpty && origin != 'null') {
        return origin;
      }
      return '';
    }
    return const String.fromEnvironment(
      'SERVER_URL',
      defaultValue: 'http://192.168.1.109:3000',
    );
  }
}
