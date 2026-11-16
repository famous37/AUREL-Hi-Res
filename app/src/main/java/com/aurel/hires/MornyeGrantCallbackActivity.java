package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Receives a Zarz one-time grant when the challenge is completed in a normal
 * browser. Does not expose the grant to JavaScript, logs, other apps or an URL.
 * The gateway validates both the nonce and the expiring signed session.
 */
public final class MornyeGrantCallbackActivity extends Activity {
    static final String ACTION_RESULT="com.aurel.hires.MORNYE_GRANT_RESULT";
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        Uri uri=getIntent()==null?null:getIntent().getData();
        if(uri==null||!"mornye".equalsIgnoreCase(uri.getScheme())||
           !"session-grant".equalsIgnoreCase(uri.getHost())){
            forward(false,"Unrecognized Zarz verification callback.");
            return;
        }
        final String nonce=uri.getQueryParameter("state");
        String value=uri.getQueryParameter("grant");
        if(value==null||value.isEmpty())value=uri.getQueryParameter("code");
        final String grant=value;
        if(nonce==null||nonce.isEmpty()||grant==null||grant.isEmpty()||
            grant.length()>16384){
            forward(false,"The verification page returned no valid grant.");
            return;
        }
        worker.execute(()->{
            boolean connected=false;
            String error="";
            try {
                SecureStore store=new SecureStore(this);
                MornyeGateway gateway=new MornyeGateway(store);
                JSONObject response=gateway.completeGrant(nonce,grant);
                connected=response.optBoolean("connected",false);
                if(connected)store.put("authMode","mornye");
                else error="Zarz did not approve the returned session grant.";
            }catch(Exception e){
                error=e.getMessage()==null?"Zarz grant exchange failed.":e.getMessage();
            }
            final boolean ok=connected;
            final String resultMessage=error;
            main.post(()->forward(ok,resultMessage));
        });
    }
    private void forward(boolean success,String error){
        Intent open=new Intent(this,MainActivity.class);
        open.setAction(ACTION_RESULT);
        open.putExtra("connected",success);
        if(!success)open.putExtra("error",error);
        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|
            Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(open);
        finish();
    }
    @Override protected void onDestroy(){
        worker.shutdown();
        super.onDestroy();
    }
}
