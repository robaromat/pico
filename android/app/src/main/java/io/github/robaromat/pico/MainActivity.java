package io.github.robaromat.pico;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Pico dans sa propre fenêtre web (WebView), sans passer par Chrome.
 * La page reste la même que sur https://robaromat.github.io/pico/ : l'appli n'est qu'un cadre.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://robaromat.github.io/pico/";
    private static final String HOST = "robaromat.github.io";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(0xFFDDF1FF);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " PicoApp/1");

        web.addJavascriptInterface(new Bridge(), "PicoAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                // On reste sur le site de Pico ; tout autre lien est ignoré (pas de navigation libre).
                Uri u = req.getUrl();
                return !HOST.equals(u.getHost());
            }
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** Fonctions appelables depuis la page : window.PicoAndroid.xxx(). */
    private class Bridge {
        @JavascriptInterface
        public String version() {
            return "1";
        }

        /** Le jeu passe en paysage plein écran, puis revient en mode normal. */
        @JavascriptInterface
        public void setLandscape(boolean on) {
            runOnUiThread(() -> {
                setRequestedOrientation(on ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                View d = getWindow().getDecorView();
                if (on) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                }
            });
        }
    }
}
