// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appTitle => 'Automação de Formulários';

  @override
  String get homeTitle => 'Formulários de Inspeção';

  @override
  String get syncStatus => 'Status de Sincronização';

  @override
  String get online => 'Conectado';

  @override
  String get offline => 'Offline (Salvo localmente)';

  @override
  String syncPending(int count) {
    return 'Sincronização pendente: $count';
  }

  @override
  String get saveDraft => 'Salvar Rascunho';

  @override
  String get submitForm => 'Enviar Formulário';

  @override
  String get noForms => 'Nenhum rascunho disponível';

  @override
  String get formSaved => 'Salvo em rascunhos locais';

  @override
  String get formSynced => 'Sincronizado com sucesso!';

  @override
  String get photoField => 'Toque para tirar/enviar foto';

  @override
  String get cropPhoto => 'Cortar Foto';

  @override
  String get compressing => 'Comprimindo foto...';

  @override
  String get selectLanguage => 'Selecionar Idioma';
}
