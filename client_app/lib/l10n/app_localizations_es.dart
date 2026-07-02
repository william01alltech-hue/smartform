// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTitle => 'Automatización de Formularios';

  @override
  String get homeTitle => 'Formularios de Inspección';

  @override
  String get syncStatus => 'Estado de Sincronización';

  @override
  String get online => 'Conectado';

  @override
  String get offline => 'Fuera de línea (Guardado)';

  @override
  String syncPending(int count) {
    return 'Sincronización pendiente: $count';
  }

  @override
  String get saveDraft => 'Guardar Borrador';

  @override
  String get submitForm => 'Enviar Formulario';

  @override
  String get noForms => 'No hay borradores';

  @override
  String get formSaved => 'Guardado en borradores locales';

  @override
  String get formSynced => '¡Sincronizado con éxito!';

  @override
  String get photoField => 'Toca para tomar/subir foto';

  @override
  String get cropPhoto => 'Recortar Foto';

  @override
  String get compressing => 'Comprimiendo foto...';

  @override
  String get selectLanguage => 'Seleccionar Idioma';
}
