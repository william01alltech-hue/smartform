import 'dart:convert';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../services/offline_service.dart';
import '../services/sync_service.dart';
import '../services/api_service.dart';
import 'dart:async';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../services/ad_service.dart';

class AccountPanel extends StatefulWidget {
  final VoidCallback onStateChanged;

  const AccountPanel({super.key, required this.onStateChanged});

  @override
  State<AccountPanel> createState() => _AccountPanelState();
}

class _AccountPanelState extends State<AccountPanel> with SingleTickerProviderStateMixin {
  final TextEditingController _tokenController = TextEditingController();
  bool _isLoading = false;
  String _statusMessage = '';
  bool _isSuccess = false;

  // Points State
  int _freePoints = 0;
  int _paidPoints = 0;
  int _totalPoints = 0;
  int _dailyAdWatchCount = 0;
  String _subscriptionPlan = 'personal_ad';

  late AnimationController _pulseController;
  StreamSubscription<List<PurchaseDetails>>? _iapSubscription;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    final currentToken = OfflineService.getUserToken();
    if (currentToken != null) {
      _tokenController.text = currentToken;
      ApiService.setToken(currentToken);
      _fetchPointsStatus();
    }

    final purchaseUpdated = InAppPurchase.instance.purchaseStream;
    _iapSubscription = purchaseUpdated.listen((purchaseDetailsList) {
      _listenToPurchaseUpdated(purchaseDetailsList);
    }, onDone: () {
      _iapSubscription?.cancel();
    }, onError: (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('內購發生錯誤: $error')));
      }
    });
  }

  @override
  void dispose() {
    _iapSubscription?.cancel();
    _tokenController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _fetchPointsStatus() async {
    final status = await ApiService.getPointsStatus();
    if (status != null && status['success'] == true) {
      setState(() {
        _freePoints = status['points']['free'] ?? 0;
        _paidPoints = status['points']['paid'] ?? 0;
        _totalPoints = status['points']['total'] ?? 0;
        _dailyAdWatchCount = status['dailyAdWatchCount'] ?? 0;
        _subscriptionPlan = status['subscriptionPlan'] ?? 'personal_ad';
      });
    }
  }

  void _watchAd() {
    setState(() => _isLoading = true);
    AdService.showRewardedAd(
      context: context,
      onUserEarnedReward: () async {
        final result = await ApiService.rewardPoints();
        if (result['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('🎉 恭喜！獲得 ${result['rewardPoints']} 點！')),
          );
          _fetchPointsStatus();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('❌ 無法獲得點數：${result['error']}')),
          );
        }
      },
      onAdClosed: () {
        setState(() => _isLoading = false);
      },
    );
  }

  Future<void> _purchaseCoins() async {
    if (kIsWeb) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('網頁版不支援官方內購，請使用手機 App。')));
      return;
    }
    setState(() => _isLoading = true);
    final isAvailable = await InAppPurchase.instance.isAvailable();
    if (!isAvailable) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('無法連接到應用程式商店。')));
      return;
    }

    const Set<String> kIds = {'com.excelapp.coins_50'};
    final ProductDetailsResponse response = await InAppPurchase.instance.queryProductDetails(kIds);
    if (response.notFoundIDs.isNotEmpty || response.productDetails.isEmpty) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('找不到金幣商品 (com.excelapp.coins_50)，請確認商店設定。')));
      return;
    }

    final ProductDetails productDetails = response.productDetails.first;
    final PurchaseParam purchaseParam = PurchaseParam(productDetails: productDetails);
    
    // 開啟原生付款畫面 (不 block, 結果會透過 purchaseStream 回傳)
    await InAppPurchase.instance.buyConsumable(purchaseParam: purchaseParam);
    
    // isLoading stays true until purchase stream returns a result or fails
  }

  void _listenToPurchaseUpdated(List<PurchaseDetails> purchaseDetailsList) async {
    for (final PurchaseDetails purchaseDetails in purchaseDetailsList) {
      if (purchaseDetails.status == PurchaseStatus.pending) {
        setState(() => _isLoading = true);
      } else {
        if (purchaseDetails.status == PurchaseStatus.error) {
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('付款錯誤: ${purchaseDetails.error?.message}')));
        } else if (purchaseDetails.status == PurchaseStatus.purchased ||
                   purchaseDetails.status == PurchaseStatus.restored) {
          
          // Call our backend to actually give the user 50 points
          final result = await ApiService.purchasePoints(50);
          setState(() => _isLoading = false);
          
          if (result['success'] == true) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('🎉 購買成功！獲得 50 金幣！')));
            _fetchPointsStatus();
          } else {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('❌ 發送金幣失敗：${result['error']}')));
          }
        }
        if (purchaseDetails.pendingCompletePurchase) {
          await InAppPurchase.instance.completePurchase(purchaseDetails);
        }
      }
    }
  }

  Future<void> _bindToken() async {
    final token = _tokenController.text.trim();
    if (token.isEmpty) {
      setState(() {
        _statusMessage = '請輸入金鑰';
        _isSuccess = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = '正在驗證金鑰...';
      _isSuccess = false;
    });

    try {
      final baseUrl = SyncService().serverBaseUrl;
      final response = await http.post(
        Uri.parse('$baseUrl/api/auth/verify-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'token': token}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final role = data['role'] as String;
          await OfflineService.setUserToken(token);
          await OfflineService.setUserRole(role);
          ApiService.setToken(token);

          setState(() {
            _statusMessage = '🎉 驗證成功！角色為：${role == 'master' ? '主帳號 (Master)' : '成員 (Sub-account)'}';
            _isSuccess = true;
          });

          await _fetchPointsStatus();

          if (role == 'member') {
            await _syncTemplates();
          }

          widget.onStateChanged();
        } else {
          setState(() {
            _statusMessage = '驗證失敗：${data['error'] ?? '原因未知'}';
            _isSuccess = false;
          });
        }
      } else {
        setState(() {
          _statusMessage = '連線失敗，狀態碼：${response.statusCode}';
          _isSuccess = false;
        });
      }
    } catch (e) {
      setState(() {
        _statusMessage = '連線出錯，請確認後端伺服器已啟動！\nError: $e';
        _isSuccess = false;
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    await OfflineService.setUserToken(null);
    await OfflineService.setUserRole('free');
    await OfflineService.saveSyncedTemplates([]);
    ApiService.setToken('');
    _tokenController.clear();
    setState(() {
      _statusMessage = '已清除綁定金鑰，切換回免費版。';
      _isSuccess = true;
      _totalPoints = 0;
      _freePoints = 0;
      _paidPoints = 0;
    });
    widget.onStateChanged();
  }

  Future<void> _syncTemplates() async {
    final token = OfflineService.getUserToken();
    if (token == null) return;

    setState(() {
      _isLoading = true;
      _statusMessage = '正在從雲端同步範本...';
    });

    try {
      final baseUrl = SyncService().serverBaseUrl;
      final response = await http.get(Uri.parse('$baseUrl/api/templates?token=$token'));

      if (response.statusCode == 200) {
        final List templatesList = jsonDecode(response.body);
        final List<Map> finalTemplates = [];

        Directory? templateDir;
        if (!kIsWeb) {
          final appDir = await getApplicationDocumentsDirectory();
          templateDir = Directory('${appDir.path}/templates');
          if (!await templateDir.exists()) await templateDir.create(recursive: true);
        }

        for (final temp in templatesList) {
          final id = temp['id'] as String;
          final title = temp['title'] as String;
          final config = temp['config'] as Map;
          final folder = (temp['folder'] as String?) ?? '未分類';

          if (kIsWeb) {
            finalTemplates.add({
              'id': id, 'title': title, 'config': config, 'folder': folder, 'localExcelPath': '',
            });
          } else {
            final excelRes = await http.get(Uri.parse('$baseUrl/api/templates/$id/excel'));
            if (excelRes.statusCode == 200) {
              final localExcelPath = '${templateDir!.path}/$id.xlsx';
              final localFile = File(localExcelPath);
              await localFile.writeAsBytes(excelRes.bodyBytes);
              finalTemplates.add({
                'id': id, 'title': title, 'config': config, 'folder': folder, 'localExcelPath': localExcelPath,
              });
            }
          }
        }

        await OfflineService.saveSyncedTemplates(finalTemplates);
        setState(() {
          _statusMessage = '🎉 同步完成！共下載 ${finalTemplates.length} 個範本。';
          _isSuccess = true;
        });
        widget.onStateChanged();
      } else {
        setState(() {
          _statusMessage = '下載範本失敗，狀態碼：${response.statusCode}';
          _isSuccess = false;
        });
      }
    } catch (e) {
      setState(() {
        _statusMessage = '下載範本失敗，請檢查網路連線！\nError: $e';
        _isSuccess = false;
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Widget _buildGlassmorphismCard({required Widget child}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _buildPointsWallet() {
    return _buildGlassmorphismCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '💰 點數錢包',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('點數 (廣告獲得)', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12)),
                    Text('$_freePoints / 300', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('金幣 (購買獲得)', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12)),
                    Text('$_paidPoints', style: const TextStyle(color: Colors.amberAccent, fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: _isLoading || _dailyAdWatchCount >= 10 ? null : _watchAd,
            icon: const Icon(Icons.play_circle_fill, color: Colors.white),
            label: Text(
              _dailyAdWatchCount >= 10 ? '今日廣告次數已達上限 (10/10)' : '觀看廣告領取點數 ($_dailyAdWatchCount/10)',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _dailyAdWatchCount >= 10 ? Colors.grey[800] : const Color(0xFFE11D48),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 8,
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _isLoading ? null : _purchaseCoins,
            icon: const Icon(Icons.shopping_cart, color: Colors.amberAccent),
            label: const Text('購買擴充金幣 (50金幣)', style: TextStyle(color: Colors.amberAccent)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.amberAccent),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _isLoading ? null : _showLedgerDialog,
            icon: const Icon(Icons.history, color: Colors.cyanAccent),
            label: const Text('查詢明細與到期日', style: TextStyle(color: Colors.cyanAccent)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.cyanAccent),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showLedgerDialog() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getPointsLedger();
    setState(() => _isLoading = false);

    if (!mounted) return;

    if (data == null || data['success'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('無法取得明細資料')));
      return;
    }

    final ledger = data['ledger'] as List? ?? [];
    final sub = data['subscription'] as Map? ?? {};
    final plan = sub['plan'] ?? '免費/廣告版';
    final subCreatedAt = sub['createdAt'] != null ? DateTime.tryParse(sub['createdAt']) : null;
    final subExpiresAt = sub['expiresAt'] != null ? DateTime.tryParse(sub['expiresAt']) : null;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('資產與訂閱明細', style: TextStyle(color: Colors.white)),
          content: SizedBox(
            width: double.maxFinite,
            height: 400,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Subscription Info
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.indigo.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.indigo.withValues(alpha: 0.5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('目前的訂閱方案：$plan', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      if (subCreatedAt != null)
                        Text('訂閱開始日：${subCreatedAt.toLocal().toString().split(' ')[0]}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      if (subExpiresAt != null)
                        Text('訂閱到期日：${subExpiresAt.toLocal().toString().split(' ')[0]}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('點數與金幣明細：', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                const Divider(color: Colors.white24),
                Expanded(
                  child: ledger.isEmpty
                      ? const Center(child: Text('尚無點數或金幣紀錄', style: TextStyle(color: Colors.white54)))
                      : ListView.builder(
                          itemCount: ledger.length,
                          itemBuilder: (context, index) {
                            final item = ledger[index];
                            final amount = item['amount'] ?? 0;
                            final type = item['type'] == 'paid' ? '金幣' : '點數';
                            final color = item['type'] == 'paid' ? Colors.amberAccent : Colors.lightBlueAccent;
                            
                            final createdAt = item['createdAt'] != null ? DateTime.tryParse(item['createdAt']) : null;
                            final expiresAt = item['expiresAt'] != null ? DateTime.tryParse(item['expiresAt']) : null;
                            
                            int remainingDays = 0;
                            if (expiresAt != null) {
                              remainingDays = expiresAt.difference(DateTime.now()).inDays;
                            }

                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                backgroundColor: color.withValues(alpha: 0.2),
                                child: Text(type[0], style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                              ),
                              title: Text('$amount $type', style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                '獲得：${createdAt?.toLocal().toString().split(' ')[0] ?? '未知'}\n'
                                '${remainingDays > 0 ? '剩下 $remainingDays 天到期' : '即將到期 / 已過期'}',
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('關閉'),
            )
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentRole = OfflineService.getUserRole();
    final isBound = currentRole == 'master' || currentRole == 'member';

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF0F172A), const Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (isBound) ...[
            _buildPointsWallet(),
            const SizedBox(height: 24),
          ],

          _buildGlassmorphismCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(Icons.security, color: isBound ? Colors.greenAccent : Colors.indigoAccent),
                    const SizedBox(width: 8),
                    Text(
                      isBound ? '已啟用帳號授權' : '輸入帳號授權碼',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (isBound) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '身分：${currentRole == 'master' ? '主帳號 (Master)' : '成員副帳號 (Member)'}',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '目前方案：$_subscriptionPlan',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _isLoading ? null : _syncTemplates,
                    icon: const Icon(Icons.sync),
                    label: const Text('同步雲端表單範本'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _isLoading ? null : _logout,
                    icon: const Icon(Icons.logout, color: Colors.redAccent),
                    label: const Text('清除綁定並登出', style: TextStyle(color: Colors.redAccent)),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: Colors.redAccent.withValues(alpha: 0.5)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ] else ...[
                  TextField(
                    controller: _tokenController,
                    decoration: InputDecoration(
                      hintText: '請輸入 Token...',
                      hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                      prefixIcon: Icon(Icons.vpn_key, color: Colors.white.withValues(alpha: 0.7)),
                      filled: true,
                      fillColor: Colors.black.withValues(alpha: 0.2),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    style: const TextStyle(color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _bindToken,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 4,
                    ),
                    child: _isLoading 
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('驗證並登入', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ],
              ],
            ),
          ),
          
          if (_statusMessage.isNotEmpty) ...[
            const SizedBox(height: 16),
            AnimatedOpacity(
              opacity: 1.0,
              duration: const Duration(milliseconds: 300),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isSuccess ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _isSuccess ? Colors.green.withValues(alpha: 0.3) : Colors.red.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _statusMessage,
                  style: TextStyle(
                    color: _isSuccess ? Colors.greenAccent : Colors.redAccent,
                    fontSize: 13,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
