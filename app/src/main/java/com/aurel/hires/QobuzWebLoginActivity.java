package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.util.Map;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * An interactive, first-party Qobuz browser sign-in. The user solves CAPTCHA
 * in the Qobuz page; AUREL never sees a password or intercepts credentials.
 * No JavaScriptInterface is exposed to remote pages. The only JavaScript
 * evaluated reads a small list of known Qobuz session fields from
 * play.qobuz.com after the user explicitly presses "Use this session".
 */
public final class QobuzWebLoginActivity extends Activity {
    static final String EXTRA_TOKEN="aurel.web.token";
    static final String EXTRA_APP_ID="aurel.web.appid";
    static final String EXTRA_LIBRARY="aurel.web.library";
    private static final String LOGIN_URL="https://play.qobuz.com/login";
    private WebView browser;
    private TextView status;
    private boolean extracting=false;
    private volatile String observedAppId="";

    private static boolean isQobuz(Uri uri){
        if(uri==null||!"https".equalsIgnoreCase(uri.getScheme()))return false;
        String host=uri.getHost();
        return host!=null&&("qobuz.com".equalsIgnoreCase(host)||
                host.toLowerCase(java.util.Locale.ROOT).endsWith(".qobuz.com"));
    }
    private static boolean isPlayer(Uri uri){
        return isQobuz(uri)&&"play.qobuz.com".equalsIgnoreCase(uri.getHost());
    }
    private Button button(String text,View.OnClickListener listener){
        Button button=new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setOnClickListener(listener);
        button.setMinHeight(dp(50));
        return button;
    }
    private int dp(int size){return (int)(size*getResources().getDisplayMetrics().density+0.5f);}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(18,16,22));
        getWindow().setNavigationBarColor(Color.rgb(18,16,22));
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(24,20,30));
        root.setFitsSystemWindows(true);
        TextView heading=new TextView(this);
        heading.setText("Qobuz Web · CAPTCHA");
        heading.setTextColor(Color.WHITE);
        heading.setTextSize(19);
        heading.setTypeface(null,1);
        heading.setPadding(dp(18),dp(12),dp(18),dp(6));
        root.addView(heading,new LinearLayout.LayoutParams(-1,dp(50)));
        status=new TextView(this);
        status.setText("Sign in on the official Qobuz page. Complete verification here if requested.");
        status.setTextColor(Color.rgb(221,204,238));
        status.setTextSize(14);
        status.setPadding(dp(18),dp(4),dp(18),dp(9));
        root.addView(status,new LinearLayout.LayoutParams(-1,-2));

        browser=new WebView(this);
        browser.setBackgroundColor(Color.rgb(24,20,30));
        WebSettings settings=browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSaveFormData(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser,true);
        browser.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int percent){
                if(percent<100&&!extracting)status.setText("Qobuz is loading ("+percent+"%)…");
                else if(!extracting)status.setText(
                    "Sign in, complete any CAPTCHA, then tap Use this session.");
            }
        });
        browser.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if(isQobuz(uri))return false;
                // External SSO destinations may be necessary; do not render them
                // under the Qobuz origin or expose them to the session extractor.
                try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
                catch(Exception ignored){status.setText("Open the official Qobuz website in your browser if sign-in is blocked.");}
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                // The public App ID may be visible in the official web player's
                // own X-App-Id request header; do not record auth-token headers.
                Uri requestUri=request.getUrl();
                if(isQobuz(requestUri)&&
                    requestUri.getPath()!=null&&requestUri.getPath().contains("/api.json/")){
                    Map<String,String> headers=request.getRequestHeaders();
                    if(headers!=null)for(Map.Entry<String,String> item:headers.entrySet()){
                        if("x-app-id".equalsIgnoreCase(item.getKey())){
                            String candidate=item.getValue();
                            if(candidate!=null&&candidate.matches("[0-9]{6,15}"))
                                observedAppId=candidate;
                        }
                    }
                }
                return null;
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error){
                if(request.isForMainFrame())status.setText("Qobuz page unavailable. Check your connection or use the external browser.");
            }
        });
        root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));

        LinearLayout controls=new LinearLayout(this);
        controls.setGravity(Gravity.CENTER);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setPadding(dp(5),dp(5),dp(5),dp(7));
        Button cancel=button("Cancel",v->finish());
        Button external=button("Browser",v->{
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(LOGIN_URL)));}
            catch(Exception ignored){status.setText("No external browser available.");}
        });
        Button done=button("Use this session",v->extract());
        controls.addView(cancel,new LinearLayout.LayoutParams(0,dp(51),1));
        controls.addView(external,new LinearLayout.LayoutParams(0,dp(51),1));
        controls.addView(done,new LinearLayout.LayoutParams(0,dp(51),1.5f));
        root.addView(controls,new LinearLayout.LayoutParams(-1,dp(63)));
        setContentView(root);
        browser.loadUrl(LOGIN_URL);
    }

    private void extract(){
        if(browser==null||extracting)return;
        Uri uri=Uri.parse(browser.getUrl()==null?"":browser.getUrl());
        if(!isPlayer(uri)){
            status.setText("Finish Qobuz verification, return to play.qobuz.com, then tap again.");
            browser.loadUrl("https://play.qobuz.com/");
            return;
        }
        extracting=true;
        status.setText("Checking the session saved by the Qobuz website…");
        // This code executes only in the first-party play.qobuz.com context.
        // No passwords, cookie contents, or unrelated localStorage keys are read.
        String js="(function(){try{"+
            "var u=localStorage.getItem('localuser');var p=u?JSON.parse(u):{};"+
            "var keys=['token','user_auth_token','userAuthToken'];"+
            "var t='';for(var i=0;i<keys.length;i++){if(typeof p[keys[i]]==='string'&&p[keys[i]].length>9){t=p[keys[i]];break;}}"+
            "if(!t&&p.user&&typeof p.user==='object'){for(var i=0;i<keys.length;i++){if(typeof p.user[keys[i]]==='string'){t=p.user[keys[i]];break;}}}"+
            "if(!t){for(var i=0;i<keys.length;i++){var v=localStorage.getItem(keys[i]);if(v&&v.length>9){t=v;break;}}}"+
            "return JSON.stringify({token:t,found:!!t});"+
            "}catch(e){return JSON.stringify({token:'',found:false});}})();";
        browser.evaluateJavascript(js,response->{
            extracting=false;
            try{
                String decoded=new JSONArray("["+response+"]").getString(0);
                JSONObject result=new JSONObject(decoded);
                String token=result.optString("token","");
                if(token.length()<10){
                    status.setText("No session token found. Finish Qobuz sign-in first, or return to AUREL and paste the token manually.");
                    return;
                }
                Intent data=new Intent();
                data.putExtra(EXTRA_TOKEN,token);
                if(!observedAppId.isEmpty())data.putExtra(EXTRA_APP_ID,observedAppId);
                data.putExtra(EXTRA_LIBRARY,getIntent().getBooleanExtra(EXTRA_LIBRARY,false));
                setResult(RESULT_OK,data);
                finish();
            }catch(Exception ignored){
                status.setText("Qobuz session format has changed. Use manual token login.");
            }
        });
    }

    @Override public void onBackPressed(){
        if(browser!=null&&browser.canGoBack())browser.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(browser!=null){
            ViewGroup parent=(ViewGroup)browser.getParent();
            if(parent!=null)parent.removeView(browser);
            browser.stopLoading();
            browser.destroy();browser=null;
        }
        super.onDestroy();
    }
}
