package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.widget.FrameLayout;
import android.os.Build;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/**
 * In-app verification of the Mornye/Zarz one-time session grant.
 * This opens only the gateway challenge returned by /bootstrap, NOT
 * the desktop-only Qobuz Web Player. No JavaScript bridge is installed.
 */
public final class MornyeVerificationActivity extends Activity {
    static final String EXTRA_URL="verificationUrl";
    static final String EXTRA_STATE="verificationState";
    static final String EXTRA_GRANT="sessionGrant";
    private String state;
    private String challenge;
    private WebView web;
    private TextView status;
    private ProgressBar progress;
    private boolean complete=false;

    private static boolean allowedStart(Uri uri){
        return uri!=null&&"https".equalsIgnoreCase(uri.getScheme())&&
            "api.zarz.moe".equalsIgnoreCase(uri.getHost())&&
            uri.getPath()!=null&&uri.getPath().startsWith("/v2/");
    }
    private int dp(float value){return (int)(getResources().getDisplayMetrics().density*value+.5f);}
    private TextView label(String text,int size){
        TextView t=new TextView(this);t.setText(text);t.setTextSize(size);
        t.setTextColor(Color.rgb(238,229,245));return t;
    }
    private void message(String s){runOnUiThread(()->{if(!complete&&status!=null)status.setText(s);});}
    private boolean callback(Uri uri){
        if(uri==null)return false;
        if(!"mornye".equalsIgnoreCase(uri.getScheme())||
           !"session-grant".equalsIgnoreCase(uri.getHost()))return false;
        if(complete)return true;
        String responseState=uri.getQueryParameter("state");
        String grant=uri.getQueryParameter("grant");
        if(grant==null||grant.isEmpty())grant=uri.getQueryParameter("code");
        if(responseState==null||!responseState.equals(state)||
           grant==null||grant.isEmpty()||grant.length()>16384){
            message("Verification did not match this sign-in request. Restart the connection.");
            return true;
        }
        complete=true;
        Intent result=new Intent();
        result.putExtra(EXTRA_STATE,responseState);
        result.putExtra(EXTRA_GRANT,grant);
        setResult(RESULT_OK,result);
        finish();
        return true;
    }
    @Override public void onCreate(Bundle bundle){
        super.onCreate(bundle);
        getWindow().setStatusBarColor(Color.rgb(12,12,16));
        getWindow().setNavigationBarColor(Color.rgb(12,12,16));
        getWindow().getDecorView().setSystemUiVisibility(0);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        state=getIntent().getStringExtra(EXTRA_STATE);
        challenge=getIntent().getStringExtra(EXTRA_URL);
        if(state==null||state.isEmpty()||challenge==null||!allowedStart(Uri.parse(challenge))){
            setResult(RESULT_CANCELED);finish();return;
        }
        LinearLayout column=new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setBackgroundColor(Color.rgb(24,20,31));
        column.setPadding(dp(14),dp(15),dp(14),dp(9));
        TextView heading=label("Mornye · Secure verification",20);
        heading.setTypeface(null,1);
        column.addView(heading);
        TextView description=label("Complete the Zarz gateway check below. Qobuz Web Player is not used.",13);
        description.setPadding(0,dp(8),0,dp(8));
        column.addView(description);
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);column.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
        status=label("Waiting for Zarz / Cloudflare. If it stays on Verifying, use the browser option below.",13);
        status.setPadding(0,dp(7),0,dp(9));column.addView(status);
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(24,20,31));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.getSettings().setLoadWithOverviewMode(true);
        web.getSettings().setUseWideViewPort(true);
        // Keep the stock Android WebView user agent unchanged for Cloudflare.
        web.getSettings().setUserAgentString(web.getSettings().getUserAgentString());
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int percent){
                if(progress!=null)progress.setProgress(percent);
                if(percent==100)message("Complete any required gateway verification.");
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri u=request.getUrl();
                if(callback(u))return true;
                // Turnstile may use about:blank and about:srcdoc within frames.
                if(u!=null&&"about".equalsIgnoreCase(u.getScheme())&&
                   ("blank".equalsIgnoreCase(u.getSchemeSpecificPart())||
                    "srcdoc".equalsIgnoreCase(u.getSchemeSpecificPart())))return false;
                if(u!=null&&"https".equalsIgnoreCase(u.getScheme())){
                    // The gateway may redirect to its human-verification provider.
                    // No insecure HTTP or file/content URL can be loaded.
                    if("play.qobuz.com".equalsIgnoreCase(u.getHost())){
                        message("Zarz redirected to the unsupported Qobuz Web Player. Use Token or Password sign-in.");
                        return true;
                    }
                    return false;
                }
                message("Unsupported verification redirect.");
                return true;
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,
                                                   WebResourceError error){
                if(request.isForMainFrame())message("Gateway verification page failed to load. Check the connection and retry.");
            }
        });
        column.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        Button external=new Button(this);
        external.setText("OPEN ZARZ CHECK IN BROWSER");
        external.setOnClickListener(v->{
            try{
                Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(challenge));
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                startActivity(intent);
                message("Finish the Zarz check in your browser. Return via the Android app chooser to AUREL.");
            }catch(Exception e){message("No browser is available for the Zarz verification.");}
        });
        column.addView(external,new LinearLayout.LayoutParams(-1,dp(48)));
        Button retry=new Button(this);
        retry.setText("Reload verification");
        retry.setOnClickListener(v->{if(web!=null){message("Reloading verification…");web.loadUrl(challenge);}});
        column.addView(retry,new LinearLayout.LayoutParams(-1,dp(49)));
        Button cancel=new Button(this);cancel.setText("Cancel");
        cancel.setOnClickListener(v->{setResult(RESULT_CANCELED);finish();});
        column.addView(cancel,new LinearLayout.LayoutParams(-1,dp(49)));
        FrameLayout safeArea=new FrameLayout(this);
        safeArea.setBackgroundColor(Color.rgb(24,20,31));
        safeArea.addView(column,new FrameLayout.LayoutParams(-1,-1));
        if(Build.VERSION.SDK_INT>=30){
            safeArea.setOnApplyWindowInsetsListener((view,insets)->{
                Insets system=insets.getInsets(WindowInsets.Type.systemBars()|
                    WindowInsets.Type.displayCutout());
                Insets keyboard=insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(system.left,system.top,system.right,
                    Math.max(system.bottom,keyboard.bottom));
                return WindowInsets.CONSUMED;
            });
        }else safeArea.setFitsSystemWindows(true);
        setContentView(safeArea);
        safeArea.requestApplyInsets();
        web.loadUrl(challenge);
    }
    @Override public void onBackPressed(){
        if(web!=null&&web.canGoBack()&&!complete){web.goBack();return;}
        setResult(RESULT_CANCELED);super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(web!=null){web.stopLoading();web.destroy();web=null;}
        super.onDestroy();
    }
}
