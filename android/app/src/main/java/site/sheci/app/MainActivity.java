package site.sheci.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** 一个最小的 WebView 外壳：把个人站装进 App 里。
 *  站内该有的逻辑（主题、音乐、看板娘、PWA）都靠 localStorage 和 JS 自己跑，
 *  这里只负责给它一个全屏、可返回的容器。 */
public class MainActivity extends Activity {

    private static final String HOME = "https://shuizhilanll.github.io/xuexi-ceshi/";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                       // 主题 / 音乐 / 看板娘都靠 localStorage
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);       // 让站内的自动播放逻辑自己决定
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setBackgroundColor(0xFF14101C);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl(HOME);

        setContentView(web);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}