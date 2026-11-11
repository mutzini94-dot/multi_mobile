package at.toon.multiview;

import android.content.Intent;
import android.net.Uri;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * 투네이션 연동 (웹: src/native/toonation/nativeFetch.ts)
 * - fetch: 앱이 대신 요청한다. 브라우저 CORS 제한 없이, 앱에 저장된 쿠키(toon.at 로그인)를 실어 보내고 받은 쿠키는 저장한다.
 *   허용한 주소(https, 투네이션·유튜브·트위치·치지직·숲)만.
 * - login: toon.at 공식 로그인 화면(ToonationLoginActivity)을 연다. 비밀번호는 앱이 다루지 않는다.
 * - logout: 앱에 저장된 toon.at 쿠키를 지운다.
 * - showDonate/hideDonate: 후원 페이지를 앱 화면 위 지정한 자리에 별도 웹뷰로 띄운다.
 *   웹 화면 속(iframe)이 아니라 맨 위 페이지라 로그인 창에서 받은 toon.at 쿠키가 그대로 쓰인다 (로그인 상태로 후원).
 */
@CapacitorPlugin(name = "Toonation")
public class ToonationPlugin extends Plugin {
    private static final String[] ALLOWED_HOSTS = {
        "toon.at", "toona.xyz", "youtube.com", "twitch.tv", "naver.com", "sooplive.co.kr", "sooplive.com", "afreecatv.com"
    };
    private static final String DEFAULT_UA =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

    static boolean allowed(String url) {
        try {
            Uri u = Uri.parse(url);
            if (!"https".equals(u.getScheme()) || u.getHost() == null) return false;
            String host = u.getHost().toLowerCase();
            for (String h : ALLOWED_HOSTS) if (host.equals(h) || host.endsWith("." + h)) return true;
        } catch (Exception ignored) {
            // 잘못된 주소
        }
        return false;
    }

    @PluginMethod
    public void fetch(final PluginCall call) {
        final String start = call.getString("url", "");
        if (!allowed(start)) {
            call.reject("BLOCKED_URL");
            return;
        }
        final String method = call.getString("method", "GET").toUpperCase();
        final JSObject headers = call.getObject("headers", new JSObject());
        final String body = call.getString("body", null);
        new Thread(() -> {
            try {
                call.resolve(request(start, method, headers, body));
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    private JSObject request(String start, String method, JSObject headers, String body) throws Exception {
        CookieManager cookies = CookieManager.getInstance();
        String url = start;
        for (int hop = 0; hop < 6; hop++) {
            if (!allowed(url)) throw new Exception("BLOCKED_REDIRECT");
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestMethod(hop == 0 ? method : "GET");
            c.setRequestProperty("User-Agent", DEFAULT_UA);
            String extraCookie = null;
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                String v = headers.getString(k);
                if (v == null) continue;
                if ("cookie".equalsIgnoreCase(k)) extraCookie = v;
                else c.setRequestProperty(k, v);
            }
            String saved = cookies.getCookie(url);
            String cookie = saved == null ? extraCookie : extraCookie == null ? saved : saved + "; " + extraCookie;
            if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
            if (hop == 0 && body != null && !"GET".equals(method)) {
                c.setDoOutput(true);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = c.getResponseCode();
            Map<String, List<String>> fields = c.getHeaderFields();
            for (Map.Entry<String, List<String>> e : fields.entrySet()) {
                if (e.getKey() != null && "set-cookie".equalsIgnoreCase(e.getKey())) for (String v : e.getValue()) cookies.setCookie(url, v);
            }
            String location = c.getHeaderField("Location");
            if (status >= 300 && status < 400 && location != null) {
                url = new URL(new URL(url), location).toString();
                c.disconnect();
                continue;
            }
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            String text = "";
            if (in != null) {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                in.close();
                text = buf.toString("UTF-8");
            }
            c.disconnect();
            cookies.flush();
            JSObject res = new JSObject();
            res.put("status", status);
            res.put("url", url);
            res.put("body", text);
            return res;
        }
        throw new Exception("TOO_MANY_REDIRECTS");
    }

    @PluginMethod
    public void cookies(PluginCall call) {
        String url = call.getString("url", "");
        JSArray list = new JSArray();
        if (allowed(url)) {
            String raw = CookieManager.getInstance().getCookie(url);
            if (raw != null) {
                for (String part : raw.split(";")) {
                    int eq = part.indexOf('=');
                    if (eq <= 0) continue;
                    JSObject o = new JSObject();
                    o.put("name", part.substring(0, eq).trim());
                    o.put("value", part.substring(eq + 1).trim());
                    list.put(o);
                }
            }
        }
        JSObject res = new JSObject();
        res.put("cookies", list);
        call.resolve(res);
    }

    @PluginMethod
    public void login(PluginCall call) {
        Intent intent = new Intent(getContext(), ToonationLoginActivity.class);
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void logout(PluginCall call) {
        CookieManager cm = CookieManager.getInstance();
        for (String base : new String[] { "https://toon.at", "https://api.toon.at" }) {
            String raw = cm.getCookie(base);
            if (raw == null) continue;
            for (String part : raw.split(";")) {
                int eq = part.indexOf('=');
                if (eq <= 0) continue;
                String name = part.substring(0, eq).trim();
                cm.setCookie(base, name + "=; Max-Age=0; Path=/");
                cm.setCookie(base, name + "=; Max-Age=0; Path=/; Domain=.toon.at");
            }
        }
        cm.flush();
        call.resolve();
    }

    // ---------- 후원 페이지 웹뷰 (앱 화면 위에 겹쳐 띄운다) ----------
    private WebView donateView;
    private String donateUrl;

    /** 웹 좌표(CSS px, 앱 웹뷰 기준) → 화면 자리. url이 바뀌면 새로 불러온다 */
    @SuppressLint("SetJavaScriptEnabled")
    @PluginMethod
    public void showDonate(final PluginCall call) {
        final String url = call.getString("url", "");
        if (!allowed(url)) {
            call.reject("BLOCKED_URL");
            return;
        }
        final double x = call.getDouble("x", 0.0), y = call.getDouble("y", 0.0), w = call.getDouble("width", 0.0), h = call.getDouble("height", 0.0);
        getActivity().runOnUiThread(() -> {
            try {
                WebView app = getBridge().getWebView();
                ViewGroup root = getActivity().findViewById(android.R.id.content);
                if (donateView == null) {
                    donateView = new WebView(getActivity());
                    WebSettings ws = donateView.getSettings();
                    ws.setJavaScriptEnabled(true);
                    ws.setDomStorageEnabled(true);
                    ws.setMediaPlaybackRequiresUserGesture(false);
                    donateView.setBackgroundColor(Color.WHITE);
                    CookieManager.getInstance().setAcceptCookie(true);
                    CookieManager.getInstance().setAcceptThirdPartyCookies(donateView, true);
                    donateView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                            String u = req.getUrl().toString();
                            // 결제 앱 호출(intent:, 카드사 앱 등)은 휴대폰에 맡긴다
                            if (!u.startsWith("http")) {
                                try {
                                    Intent i = u.startsWith("intent:") ? Intent.parseUri(u, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, Uri.parse(u));
                                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    getActivity().startActivity(i);
                                } catch (Exception ignored) {
                                    // 열 수 있는 앱이 없다
                                }
                                return true;
                            }
                            return false;
                        }
                    });
                    root.addView(donateView, new FrameLayout.LayoutParams(1, 1));
                }
                // 앱 웹뷰의 화면 속 자리 + 웹 좌표 × 화면 밀도
                float d = getActivity().getResources().getDisplayMetrics().density;
                int[] a = new int[2], r = new int[2];
                app.getLocationOnScreen(a);
                root.getLocationOnScreen(r);
                ViewGroup.LayoutParams lp = donateView.getLayoutParams();
                lp.width = Math.max(1, (int) Math.round(w * d));
                lp.height = Math.max(1, (int) Math.round(h * d));
                donateView.setLayoutParams(lp);
                donateView.setX(a[0] - r[0] + app.getPaddingLeft() + (float) (x * d));
                donateView.setY(a[1] - r[1] + app.getPaddingTop() + (float) (y * d));
                donateView.setVisibility(w > 0 && h > 0 ? View.VISIBLE : View.INVISIBLE);
                donateView.bringToFront();
                if (!url.equals(donateUrl)) {
                    donateUrl = url;
                    donateView.loadUrl(url);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void hideDonate(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (donateView != null) {
                ViewGroup parent = (ViewGroup) donateView.getParent();
                if (parent != null) parent.removeView(donateView);
                donateView.destroy();
                donateView = null;
                donateUrl = null;
            }
            call.resolve();
        });
    }
}
