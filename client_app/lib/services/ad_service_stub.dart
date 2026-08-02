import 'package:flutter/material.dart';

class AdService {
  static Future<void> initialize() async {
    // No-op for web
  }

  static String get bannerAdUnitId => '';
  static String get rewardedAdUnitId => '';

  static Future<void> showRewardedAd({
    required VoidCallback onUserEarnedReward,
    required VoidCallback onAdClosed,
    required BuildContext context,
  }) async {
    // Web mock: just pretend user earned reward
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("網頁版略過廣告，直接給予獎勵！")),
    );
    onUserEarnedReward();
    onAdClosed();
  }
}

class BannerAdWidget extends StatelessWidget {
  const BannerAdWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
