import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';
import '../services/offline_service.dart';
import '../services/sync_service.dart';
import '../services/ad_service.dart';
import '../services/image_process_service.dart';
import '../services/api_service.dart';
import '../services/excel_web_service.dart';
import '../l10n/app_localizations.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';

class DynamicFormScreen extends StatefulWidget {
  final Map formConfig;
  final String templatePath;

  final String templateId;

  const DynamicFormScreen({
    super.key,
    required this.formConfig,
    required this.templatePath,
    required this.templateId,
  });

  @override
  State<DynamicFormScreen> createState() => _DynamicFormScreenState();
}

class _DynamicFormScreenState extends State<DynamicFormScreen> {
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, MaskTextInputFormatter> _formatters = {};
  final Map<String, bool> _checkboxValues = {};
  final Map<String, List<Offset>> _signaturePoints = {};
  final Map<String, String> _imagePaths = {}; // Maps field name to compressed file path
  final Map<String, String> _imageInfo = {};  // Maps field name to size info string
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    // Initialize state containers based on fields config
    final List fields = widget.formConfig['fields'] ?? [];
    for (var field in fields) {
      final String name = field['name'];
      final String type = field['type'];

      if (type == 'text' || type == 'number' || type == 'date' || type == 'mobile' || type == 'tel') {
        _controllers[name] = TextEditingController();
        if (type == 'mobile') {
          _formatters[name] = MaskTextInputFormatter(
            mask: '####-######',
            filter: { "#": RegExp(r'[0-9]') },
            type: MaskAutoCompletionType.lazy,
          );
        } else if (type == 'tel') {
          _formatters[name] = MaskTextInputFormatter(
            mask: '(##)########',
            filter: { "#": RegExp(r'[0-9]') },
            type: MaskAutoCompletionType.lazy,
          );
        }
      } else if (type == 'checkbox') {
        _checkboxValues[name] = false;
      } else if (type == 'signature') {
        _signaturePoints[name] = [];
      }
    }
  }

  @override
  void dispose() {
    for (var controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  // Convert hand drawing points to png file buffer
  Future<String> _saveSignatureToFile(String fieldName, List<Offset> points) async {
    if (points.isEmpty) return '';
    try {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, 360, 180));
      
      // Background solid fill
      final bgPaint = Paint()..color = const Color(0xFF1E293B);
      canvas.drawRect(const Rect.fromLTWH(0, 0, 360, 180), bgPaint);
      
      // Signature stroke style
      final strokePaint = Paint()
        ..color = Colors.white
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 4.0;

      for (int i = 0; i < points.length - 1; i++) {
        if (points[i] != Offset.infinite && points[i + 1] != Offset.infinite) {
          canvas.drawLine(points[i], points[i + 1], strokePaint);
        }
      }
      
      final picture = recorder.endRecording();
      final img = await picture.toImage(360, 180);
      final pngBytes = await img.toByteData(format: ui.ImageByteFormat.png);
      if (pngBytes == null) return '';

      final tempDir = Directory.systemTemp;
      final file = File('${tempDir.path}/sig_$fieldName.png');
      await file.writeAsBytes(pngBytes.buffer.asUint8List());
      return file.path;
    } catch (e) {
      debugPrint('Error saving signature to file: $e');
      return '';
    }
  }

  // Handle Photo Picker & Cropper & Compress flow
  Future<void> _pickAndProcessImage(Map field) async {
    final l10n = AppLocalizations.of(context)!;
    final String fieldName = field['name'];
    final double aspectRatio = (field['aspectRatio'] as num).toDouble();
    final String resolutionTag = field['resolutionTag'] ?? 'medium';

    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.camera);
      if (image == null) return;
      if (!mounted) return;

      // On Web, ImageCropper and dart:io File are not fully supported out of the box
      if (kIsWeb) {
        final bytes = await image.readAsBytes();
        setState(() {
          _imagePaths[fieldName] = image.path; // blob url
          _imageInfo[fieldName] = '已附加相片 (${(bytes.length / 1024).toStringAsFixed(1)} KB)';
        });
        return;
      }

      final croppedFile = await ImageCropper().cropImage(
        sourcePath: image.path,
        aspectRatio: CropAspectRatio(
          ratioX: aspectRatio, 
          ratioY: 1.0,
        ),
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: l10n.cropPhoto,
            toolbarColor: Theme.of(context).colorScheme.primary,
            toolbarWidgetColor: Colors.white,
            initAspectRatio: CropAspectRatioPreset.original,
            lockAspectRatio: true,
          ),
          IOSUiSettings(
            title: l10n.cropPhoto,
            aspectRatioLockEnabled: true,
          ),
        ],
      );

      if (croppedFile == null) return;
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.compressing),
          duration: const Duration(milliseconds: 800),
        ),
      );

      final originalSize = await File(croppedFile.path).length();
      final compressedPath = await ImageProcessService.compressImage(
        croppedFile.path, 
        resolutionTag,
      );
      final compressedSize = await File(compressedPath).length();

      setState(() {
        _imagePaths[fieldName] = compressedPath;
        _imageInfo[fieldName] = 
            '原始: ${(originalSize / 1024).toStringAsFixed(1)} KB -> '
            '壓縮: ${(compressedSize / 1024).toStringAsFixed(1)} KB (${resolutionTag.toUpperCase()})';
      });
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  Future<void> _processSignatures() async {
    for (var key in _signaturePoints.keys) {
      final points = _signaturePoints[key] ?? [];
      if (points.isNotEmpty) {
        final path = await _saveSignatureToFile(key, points);
        if (path.isNotEmpty) {
          _imagePaths[key] = path;
        }
      }
    }
  }

  void _saveLocalDraft() async {
    final l10n = AppLocalizations.of(context)!;
    final draftId = DateTime.now().millisecondsSinceEpoch.toString();
    
    await _processSignatures();

    final textData = {
      ..._controllers.map((key, controller) => MapEntry(key, controller.text)),
      ..._checkboxValues.map((key, val) => MapEntry(key, val.toString())),
    };

    final draft = {
      'id': draftId,
      'title': '工地表單草稿 $draftId',
      'createdTime': DateTime.now().toIso8601String(),
      'fields': textData,
      'images': _imagePaths,
    };

    await OfflineService.saveDraft(draftId, draft);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.formSaved),
        backgroundColor: Theme.of(context).colorScheme.secondary,
      ),
    );
    Navigator.of(context).pop();
  }

  bool _isExporting = false;

  void _submitForm() async {
    if (!_formKey.currentState!.validate()) return;
    if (_isExporting) return;

    // Verify signatures
    final List fields = widget.formConfig['fields'] ?? [];
    for (var field in fields) {
      if (field['type'] == 'signature' && field['required'] == true) {
        final points = _signaturePoints[field['name']] ?? [];
        if (points.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('請填寫必填欄位: ${field['label'] ?? field['name']}（簽名）'),
              backgroundColor: Colors.redAccent,
            ),
          );
          return;
        }
      }
    }

    setState(() => _isExporting = true);

    // 🔥 1. 匯出前呼叫後端扣除 1 點
    final consumeResult = await ApiService.consumePoints(1);
    if (consumeResult['success'] != true) {
      setState(() => _isExporting = false);
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('💰 點數不足', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          content: const Text(
            '您需要 1 點才能匯出此報表。\n請回到帳號面板觀看廣告獲取點數，或購買擴充包/升級企業版。',
            style: TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx), 
              child: const Text('我知道了', style: TextStyle(color: Colors.amberAccent))
            ),
          ],
        ),
      );
      return;
    }

    final draftId = DateTime.now().millisecondsSinceEpoch.toString();
    await _processSignatures();

    final textData = {
      ..._controllers.map((key, controller) => MapEntry(key, controller.text)),
      ..._checkboxValues.map((key, val) => MapEntry(key, val.toString())),
    };

    // 🔥 2. 算力轉移：改呼叫本地瀏覽器的 JS Worker 生成 Excel，不再傳給後端
    if (kIsWeb) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🚀 點數已扣除！正在使用您的瀏覽器本地產出 Excel...'),
          backgroundColor: Colors.indigoAccent,
          duration: Duration(seconds: 2),
        ),
      );
      
      // Call JS Worker (Mocking the base64 passing for architecture completeness)
      await ExcelWebService.fillTemplateWeb('mock_base64_template', textData, _imagePaths);
      
      setState(() => _isExporting = false);
      if (!mounted) return;
      
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('✅ 匯出成功', style: TextStyle(color: Colors.white)),
          content: const Text('已透過本地瀏覽器算力產出 Excel，並自動下載。', style: TextStyle(color: Colors.white70)),
          actions: [TextButton(onPressed: () { Navigator.pop(ctx); Navigator.pop(context); }, child: const Text('完成'))],
        ),
      );
      return;
    }

    // 舊版 Mobile 離線佇列邏輯 (若之後也要改為本地，可整合 exceljs dart package)
    final payload = {
      'id': draftId,
      'templateId': widget.templateId,
      'templatePath': widget.templatePath,
      'data': textData,
      'images': _imagePaths,
      'fields': widget.formConfig['fields'], 
    };

    await OfflineService.enqueueSubmission(draftId, payload);
    SyncService().triggerSync();
    
    setState(() => _isExporting = false);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('已扣除 1 點，並送出表單至上傳同步隊列！'),
        backgroundColor: Theme.of(context).colorScheme.secondary,
      ),
    );
    Navigator.of(context).pop();
  }

  Future<void> _selectDate(BuildContext context, String fieldName, String label) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      helpText: '選擇 $label',
    );
    if (picked != null) {
      setState(() {
        _controllers[fieldName]?.text = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final List fields = widget.formConfig['fields'] ?? [];
    final primaryColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.formConfig['title'] ?? '填寫工地表單'),
        elevation: 0,
      ),
      bottomNavigationBar: const SafeArea(child: BannerAdWidget()),
      body: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ...fields.map((field) {
                final String name = field['name'];
                final String label = field['label'] ?? name;
                final String type = field['type'];
                final bool isRequired = field['required'] == true;

                if (type == 'text' || type == 'number' || type == 'mobile' || type == 'tel') {
                  String hint = '請輸入 $label';
                  if (type == 'mobile') {
                    hint = '格式: xxxx-xxxxxx (如 0912-345678)';
                  } else if (type == 'tel') {
                    hint = '格式: (xx)xxxxxxx 或 (xx)xxxxxxxx';
                  }

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label + (isRequired ? ' *' : ''),
                          softWrap: true,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white70),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _controllers[name],
                          keyboardType: type == 'number' 
                              ? TextInputType.number 
                              : ((type == 'mobile' || type == 'tel') ? TextInputType.phone : TextInputType.text),
                          inputFormatters: (type == 'mobile' || type == 'tel') 
                              ? [_formatters[name]!] 
                              : null,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            fillColor: const Color(0xFF1E293B),
                            filled: true,
                            hintText: hint,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          validator: (value) {
                            if (isRequired && (value == null || value.trim().isEmpty)) {
                              return '此欄位不可空白';
                            }
                            if (value != null && value.trim().isNotEmpty) {
                              if (type == 'number') {
                                if (double.tryParse(value) == null) {
                                  return '請輸入有效的數字';
                                }
                              } else if (type == 'mobile') {
                                final reg = RegExp(r'^\d{4}-\d{6}$');
                                if (!reg.hasMatch(value.trim())) {
                                  return '格式不符，請輸入 xxxx-xxxxxx';
                                }
                              } else if (type == 'tel') {
                                final reg = RegExp(r'^[\(（]\d{2}[\)）]\d{7,8}$');
                                if (!reg.hasMatch(value.trim())) {
                                  return '格式不符，請輸入 (xx)xxxxxxx 或 (xx)xxxxxxxx';
                                }
                              }
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  );
                } else if (type == 'date') {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label + (isRequired ? ' *' : ''),
                          softWrap: true,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white70),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _controllers[name],
                          readOnly: true,
                          style: const TextStyle(color: Colors.white),
                          onTap: () => _selectDate(context, name, label),
                          decoration: InputDecoration(
                            fillColor: const Color(0xFF1E293B),
                            filled: true,
                            hintText: '請點擊選擇日期',
                            suffixIcon: const Icon(Icons.calendar_today, color: Colors.white54),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          validator: (value) {
                            if (isRequired && (value == null || value.trim().isEmpty)) {
                              return '請選擇日期';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  );
                } else if (type == 'checkbox') {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: CheckboxListTile(
                        title: Text(
                          label + (isRequired ? ' *' : ''),
                          softWrap: true,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white70),
                        ),
                        value: _checkboxValues[name] ?? false,
                        activeColor: primaryColor,
                        onChanged: (val) {
                          setState(() {
                            _checkboxValues[name] = val ?? false;
                          });
                        },
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                    ),
                  );
                } else if (type == 'image') {
                  final imagePath = _imagePaths[name];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label + (isRequired ? ' *' : ''),
                          softWrap: true,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white70),
                        ),
                        const SizedBox(height: 8),
                        GestureDetector(
                          onTap: () => _pickAndProcessImage(field),
                          child: Container(
                            height: 180,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: imagePath == null ? Colors.white24 : primaryColor.withValues(alpha: 0.5),
                                width: 2,
                              ),
                            ),
                            child: imagePath == null
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.camera_alt, size: 40, color: primaryColor),
                                      const SizedBox(height: 8),
                                      Text(
                                        l10n.photoField,
                                        style: const TextStyle(color: Colors.white54),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '比例: ${field['aspectRatio']} (${field['resolutionTag']})',
                                        style: const TextStyle(color: Colors.white30, fontSize: 12),
                                      )
                                    ],
                                  )
                                : ClipRRect(
                                    borderRadius: BorderRadius.circular(14),
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        kIsWeb 
                                            ? Image.network(imagePath, fit: BoxFit.cover) 
                                            : Image.file(File(imagePath), fit: BoxFit.cover),
                                        Positioned(
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          child: Container(
                                            color: Colors.black54,
                                            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                                            child: Text(
                                              _imageInfo[name] ?? '',
                                              style: const TextStyle(color: Colors.white70, fontSize: 11),
                                              textAlign: TextAlign.center,
                                            ),
                                          ),
                                        ),
                                        Positioned(
                                          top: 8,
                                          right: 8,
                                          child: CircleAvatar(
                                            backgroundColor: Colors.redAccent,
                                            radius: 16,
                                            child: IconButton(
                                              icon: const Icon(Icons.close, size: 16, color: Colors.white),
                                              onPressed: () {
                                                setState(() {
                                                  _imagePaths.remove(name);
                                                  _imageInfo.remove(name);
                                                });
                                              },
                                            ),
                                          ),
                                        )
                                      ],
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  );
                } else if (type == 'signature') {
                  final points = _signaturePoints[name] ?? [];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              label + (isRequired ? ' *' : ''),
                              softWrap: true,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white70),
                            ),
                            TextButton.icon(
                              onPressed: () {
                                setState(() {
                                  _signaturePoints[name] = [];
                                });
                              },
                              icon: const Icon(Icons.clear, size: 16, color: Colors.redAccent),
                              label: const Text('清除', style: TextStyle(color: Colors.redAccent, fontSize: 13)),
                            )
                          ],
                        ),
                        const SizedBox(height: 8),
                        Container(
                          height: 180,
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: points.isEmpty ? Colors.white24 : Colors.amber.withValues(alpha: 0.5),
                              width: 2,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: SignatureCanvas(
                              onPointsChanged: (newPoints) {
                                setState(() {
                                  _signaturePoints[name] = List.from(newPoints);
                                });
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }
                return const SizedBox.shrink();
              }),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saveLocalDraft,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: BorderSide(color: primaryColor, width: 2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        l10n.saveDraft,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isExporting ? null : _submitForm,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 4,
                      ),
                      child: _isExporting
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              l10n.submitForm,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}

class SignatureCanvas extends StatefulWidget {
  final ValueChanged<List<Offset>> onPointsChanged;
  const SignatureCanvas({super.key, required this.onPointsChanged});

  @override
  State<SignatureCanvas> createState() => _SignatureCanvasState();
}

class _SignatureCanvasState extends State<SignatureCanvas> {
  final List<Offset> _points = [];

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanUpdate: (details) {
        RenderBox referenceBox = context.findRenderObject() as RenderBox;
        Offset localPosition = referenceBox.globalToLocal(details.globalPosition);
        setState(() {
          _points.add(localPosition);
        });
        widget.onPointsChanged(_points);
      },
      onPanEnd: (details) {
        _points.add(Offset.infinite);
        widget.onPointsChanged(_points);
      },
      child: CustomPaint(
        painter: SignaturePainter(_points),
        size: Size.infinite,
      ),
    );
  }
}

class SignaturePainter extends CustomPainter {
  final List<Offset> points;
  SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.5;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != Offset.infinite && points[i + 1] != Offset.infinite) {
        canvas.drawLine(points[i], points[i + 1], paint);
      }
    }
  }

  @override
  bool shouldRepaint(SignaturePainter oldDelegate) => oldDelegate.points != points;
}
