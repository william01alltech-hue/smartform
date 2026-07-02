import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class AdService {
  static Future<void> initialize() async {
    if (kIsWeb) return;
    await MobileAds.instance.initialize();
  }

  static String get bannerAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/6300978111'; // Test ID
    if (Platform.isIOS) return 'ca-app-pub-3940256099942544/2934735716'; // Test ID
    return '';
  }

  static String get rewardedAdUnitId {
    if (Platform.isAndroid) return 'ca-app-pub-3940256099942544/5224354917'; // Test ID
    if (Platform.isIOS) return 'ca-app-pub-3940256099942544/1712485313'; // Test ID
    return '';
  }

  static Future<void> showRewardedAd({
    required VoidCallback onUserEarnedReward,
    required VoidCallback onAdClosed,
    required BuildContext context, // For web mock
  }) async {
    if (kIsWeb) {
      // Mock for Web since google_mobile_ads does not support Rewarded Ads on Web natively here
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Text('觀看廣告中...'),
          content: const Text('這是一個模擬的獎勵式影片廣告。在真實的手機上，這裡會播放影片。'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                onUserEarnedReward();
                onAdClosed();
              },
              child: const Text('看完並領取點數'),
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
