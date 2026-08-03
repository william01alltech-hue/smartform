// Web 平台的 AdSense 廣告元件
// 使用 HtmlElementView + package:web 實作，讓廣告以 HTML 元素嵌入 Flutter Canvas 中
import 'dart:js_interop';
import 'dart:ui_web' as ui;
import 'package:web/web.dart' as web;
import 'package:flutter/material.dart';

// 使用 dart:js_interop 呼叫 JavaScript 的 eval 函數
@JS('eval')
external JSAny? _jsEval(String script);

class AdBannerWidget extends StatefulWidget {
  const AdBannerWidget({super.key});

  @override
  State<AdBannerWidget> createState() => _AdBannerWidgetState();
}

class _AdBannerWidgetState extends State<AdBannerWidget> {
  static int _counter = 0;
  late final String _viewId;

  @override
  void initState() {
    super.initState();
    // 每個 AdBanner 使用唯一 ID，避免重複註冊錯誤
    _viewId = 'adsense-banner-${_counter++}';
    _registerAdView();
  }

  void _registerAdView() {
    ui.platformViewRegistry.registerViewFactory(
      _viewId,
      (int viewId) {
        // 建立外層容器
        final container =
            web.document.createElement('div') as web.HTMLDivElement;
        container.style.width = '100%';
        container.style.height = '90px';
        container.style.overflow = 'hidden';
        container.style.backgroundColor = 'transparent';

        // 建立 AdSense <ins> 標籤
        final ins = web.document.createElement('ins') as web.HTMLElement;
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.style.width = '100%';
        ins.style.height = '90px';
        // ↓ 審核通過後，將 SLOT_ID_PLACEHOLDER 換成正式的 slot-id
        ins.setAttribute('data-ad-client', 'ca-pub-2121509224213660');
        ins.setAttribute('data-ad-slot', 'SLOT_ID_PLACEHOLDER');
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');

        container.appendChild(ins);

        // 觸發 AdSense 載入廣告
        _jsEval('(window.adsbygoogle = window.adsbygoogle || []).push({})');

        return container;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 90,
      width: double.infinity,
      child: HtmlElementView(viewType: _viewId),
    );
  }
}
