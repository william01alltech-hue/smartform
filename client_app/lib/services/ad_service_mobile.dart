import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class AdService {
  static Future<void> initialize() async {
    if (kIsWeb) return;
    await MobileAds.instance.initialize();
  }

  // ⚠️ 正式發布前必須透過 --dart-define 傳入正式廣告 ID (#63)
  // 範例 (build 指令)：
  //   flutter build apk \
  //     --dart-define=AD_BANNER_ANDROID=ca-app-pub-xxxxxxxxxx/xxxxxxxxxx \
  //     --dart-define=AD_BANNER_IOS=ca-app-pub-xxxxxxxxxx/xxxxxxxxxx \
  //     --dart-define=AD_REWARD_ANDROID=ca-app-pub-xxxxxxxxxx/xxxxxxxxxx \
  //     --dart-define=AD_REWARD_IOS=ca-app-pub-xxxxxxxxxx/xxxxxxxxxx
  // 未傳入時 release build 回傳空字串，廣告不顯示但不崩潰。
  static String get bannerAdUnitId {
    if (kDebugMode) {
      // Debug 模式：使用 Google 官方測試 ID
      if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/6300978111';
      if (Platform.isIOS) return 'ca-app-pub-3940256099942544/2934735716';
      return '';
    }
    // Release 模式：必須透過 --dart-define 傳入正式 ID，defaultValue 為空字串
    if (Platform.isAndroid) return const String.fromEnvironment('AD_BANNER_ANDROID', defaultValue: '');
    if (Platform.isIOS) return const String.fromEnvironment('AD_BANNER_IOS', defaultValue: '');
    return '';
  }

  static String get rewardedAdUnitId {
    if (kDebugMode) {
      // Debug 模式：使用 Google 官方測試 ID
      if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/5224354917';
      if (Platform.isIOS) return 'ca-app-pub-3940256099942544/1712485313';
      return '';
    }
    // Release 模式：必須透過 --dart-define 傳入正式 ID，defaultValue 為空字串
    if (Platform.isAndroid) return const String.fromEnvironment('AD_REWARD_ANDROID', defaultValue: '');
    if (Platform.isIOS) return const String.fromEnvironment('AD_REWARD_IOS', defaultValue: '');
    return '';
  }

  static Future<void> showRewardedAd({
    required VoidCallback onUserEarnedReward,
    required VoidCallback onAdClosed,
    required BuildContext context, // For web mock
  }) async {
    if (kIsWeb) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('無法播放廣告'),
          content: const Text('為了維護系統公平性，獎勵廣告點數功能僅支援在 iOS 與 Android 行動裝置上進行。'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                onAdClosed();
              },
              child: const Text('確定'),
            ),
          ],
        ),
      );
      return;
    }

    RewardedAd.load(
      adUnitId: rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              onAdClosed();
            },
            onAdFailedToShowFullScreenContent: (ad, err) {
              ad.dispose();
              onAdClosed();
            },
          );
          ad.show(onUserEarnedReward: (AdWithoutView ad, RewardItem rewardItem) {
            onUserEarnedReward();
          });
        },
        onAdFailedToLoad: (err) {
          debugPrint('Failed to load a rewarded ad: \${err.message}');
          onAdClosed();
        },
      ),
    );
  }
}

class BannerAdWidget extends StatefulWidget {
  const BannerAdWidget({super.key});

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _bannerAd;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _loadAd();
    }
  }

  void _loadAd() {
    _bannerAd = BannerAd(
      adUnitId: AdService.bannerAdUnitId,
      request: const AdRequest(),
      size: AdSize.banner,
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          setState(() {
            _isLoaded = true;
          });
        },
        onAdFailedToLoad: (ad, err) {
          debugPrint('BannerAd failed to load: $err');
          ad.dispose();
        },
      ),
    )..load();
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return const SizedBox.shrink(); // Web doesn't support Google Mobile Ads
    }
    if (_isLoaded && _bannerAd != null) {
      return Container(
        alignment: Alignment.center,
        width: _bannerAd!.size.width.toDouble(),
        height: _bannerAd!.size.height.toDouble(),
        child: AdWidget(ad: _bannerAd!),
      );
    }
    return const SizedBox.shrink();
  }
}
