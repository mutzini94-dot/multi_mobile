package at.toon.multiview;

import android.graphics.Color;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * TOO 멀티뷰 안드로이드 앱: 웹 버전(dist)을 앱 안 WebView로 띄운다.
 * - 여러 방송이 손대지 않아도 자동 재생되게 (WebView 기본값은 사용자 터치가 있어야 재생)
 * - 보는 동안 화면이 꺼지지 않게
 * - 유튜브·트위치 임베드가 자기 쿠키(로그인·설정)를 쓸 수 있게 제3자 쿠키 허용
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ToonationPlugin.class); // 투네이션 연동 (로그인·요청)
        super.onCreate(savedInstanceState);
        WebView web = getBridge().getWebView();
        WebSettings settings = web.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // 상태 표시줄·내비게이션 바 자리(앱이 비워 두는 여백)의 바탕: 흰색 (아이콘은 어둡게 — capacitor.config SystemBars)
        getWindow().getDecorView().setBackgroundColor(Color.WHITE);
    }
}
