package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Optional in-app updater for the signed AUREL GitHub APK distribution.
 *
 * Update discovery is automatic only when the UI enables it. APK download
 * requires an explicit click, and Android's system installer requires user
 * confirmation. No private app credentials are sent to GitHub.
 */
final class AurelUpdateManager {
    static final int UNKNOWN_SOURCES_REQUEST=4195;
    static final String CERT_SHA256="C9F57989C6622A55440F35CD426A5DC6830161EEB5AEAB299FDB3E69F94ED3CA";
    private static final String API="https://api.github.com/repos/famous37/AUREL-Hi-Res/releases?per_page=15";
    private static final String PUBLIC_ASSETS="https://github.com/famous37/AUREL-Hi-Res/releases/download/";
    private static final String PKG="com.aurel.hires";
    private static final long MAX_APK=180L*1024*1024;
    private final Activity activity;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    interface Listener { void onChange(JSONObject state); }
    private final Listener listener;
    private Candidate candidate;
    private File verifiedApk;
    private String phase="idle",error="";
    private int progress=0;

    private static final class Candidate {
        final String version,description,url,shaUrl,releasePage;
        final long size;
        Candidate(String ver,String desc,String u,String checksum,String page,long bytes) {
            version=ver;description=desc;url=u;shaUrl=checksum;releasePage=page;size=bytes;
        }
    }
    AurelUpdateManager(Activity activity,Listener l){this.activity=activity;listener=l;}
    synchronized JSONObject state(){
        JSONObject j=new JSONObject();
        try {
            j.put("status",phase);j.put("error",error);j.put("progress",progress);
            j.put("installedVersion",installedVersion());
            j.put("supported",PKG.equals(activity.getPackageName()));
            j.put("available",candidate!=null);
            j.put("downloaded",verifiedApk!=null&&verifiedApk.isFile());
            if(candidate!=null){
                j.put("latestVersion",candidate.version);
                j.put("notes",candidate.description);
                j.put("releaseUrl",candidate.releasePage);
                j.put("fileBytes",candidate.size);
            }
        }catch(Exception ignored){}
        return j;
    }
    private void notifyChange(){if(listener!=null)listener.onChange(state());}
    synchronized JSONObject check() throws Exception{
        if("downloading".equals(phase))return state();
        phase="checking";error="";notifyChange();
        try{
            JSONArray releases=new JSONArray(new String(readSmall(API,1024*1024),StandardCharsets.UTF_8));
            String installed=installedVersion();
            Candidate best=null;
            for(int i=0;i<releases.length();i++){
                JSONObject release=releases.optJSONObject(i);
                if(release==null||release.optBoolean("draft",false))continue;
                String tag=release.optString("tag_name","");
                if(!tag.matches("^v[0-9]+\\.[0-9]+\\.[0-9]+$"))continue;
                String ver=tag.substring(1);
                if(compareVersion(ver,installed)<=0)continue;
                String name="AUREL-Hi-Res-v"+ver+".apk";
                JSONArray assets=release.optJSONArray("assets");
                if(assets==null)continue;
                String apk="",sums="";long bytes=0;
                for(int k=0;k<assets.length();k++){
                    JSONObject asset=assets.optJSONObject(k);
                    if(asset==null)continue;
                    String filename=asset.optString("name","");
                    String url=asset.optString("browser_download_url","");
                    if(!url.startsWith(PUBLIC_ASSETS+tag+"/"))continue;
                    if(name.equals(filename)){apk=url;bytes=asset.optLong("size",0);}
                    if("SHA256SUMS.txt".equals(filename))sums=url;
                }
                if(apk.isEmpty()||sums.isEmpty()||bytes<=0||bytes>MAX_APK)continue;
                if(best==null||compareVersion(ver,best.version)>0){
                    best=new Candidate(ver,release.optString("body",""),apk,sums,
                            release.optString("html_url",""),bytes);
                }
            }
            candidate=best;verifiedApk=null;
            phase=best==null?"upToDate":"available";
            error="";progress=0;
        }catch(Exception e){
            phase="error";error="Could not check updates: "+cleanError(e);
        }
        notifyChange();return state();
    }
    synchronized JSONObject download(){
        if(!PKG.equals(activity.getPackageName())){
            phase="error";error="Updates of the separate Preview application are not supported.";
            notifyChange();return state();
        }
        if(candidate==null){
            phase="error";error="Check for an update before downloading.";
            notifyChange();return state();
        }
        if("downloading".equals(phase))return state();
        if(verifiedApk!=null&&verifiedApk.isFile()){phase="downloaded";return state();}
        Candidate target=candidate;
        phase="downloading";error="";progress=0;notifyChange();
        executor.execute(()->downloadWorker(target));
        return state();
    }
    private void downloadWorker(Candidate target){
        File tmp=null;
        try{
            String sums=new String(readSmall(target.shaUrl,64*1024),StandardCharsets.UTF_8);
            String desired="AUREL-Hi-Res-v"+target.version+".apk";
            String expected=null;
            for(String line:sums.split("\\r?\\n")){
                String l=line.trim();
                String[] fields=l.split("\\s+",2);
                if(fields.length==2&&fields[0].matches("(?i)[a-f0-9]{64}") &&
                    fields[1].replaceFirst("^\\*","").trim().equals(desired)){
                    expected=fields[0].toUpperCase(Locale.ROOT);break;
                }
            }
            if(expected==null)throw new Exception("Release checksum is missing or malformed.");
            File dir=new File(activity.getCacheDir(),"updates");
            if(!dir.isDirectory()&&!dir.mkdirs())throw new Exception("Cannot create update directory.");
            tmp=new File(dir,"aurel-update.part");
            if(tmp.exists()&&!tmp.delete())throw new Exception("Cannot replace incomplete download.");
            HttpURLConnection connection=open(target.url);
            try{
                long reported=connection.getContentLengthLong();
                if(reported>MAX_APK)throw new Exception("APK exceeds maximum allowed size.");
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                long downloaded=0,lastReport=0;
                byte[] buffer=new byte[32*1024];
                try(InputStream in=connection.getInputStream(); FileOutputStream out=new FileOutputStream(tmp)){
                    int n;
                    while((n=in.read(buffer))!=-1){
                        if(Thread.currentThread().isInterrupted())throw new Exception("Download cancelled.");
                        downloaded+=n;
                        if(downloaded>MAX_APK)throw new Exception("APK exceeds maximum allowed size.");
                        out.write(buffer,0,n);digest.update(buffer,0,n);
                        if(System.currentTimeMillis()-lastReport>=300){
                            synchronized(this){
                                progress=(int)Math.min(99,downloaded*100L/Math.max(1,target.size));
                            }
                            notifyChange();lastReport=System.currentTimeMillis();
                        }
                    }
                    out.getFD().sync();
                }
                if(downloaded!=target.size)throw new Exception("APK size does not match GitHub release.");
                if(!hex(digest.digest()).equals(expected))throw new Exception("APK SHA-256 mismatch.");
            }finally{connection.disconnect();}
            verifyApk(tmp,target.version);
            File finalApk=new File(dir,"aurel-update.apk");
            if(finalApk.exists()&&!finalApk.delete())throw new Exception("Cannot replace previous update.");
            if(!tmp.renameTo(finalApk))throw new Exception("Cannot save verified update.");
            synchronized(this){
                if(candidate!=target)throw new Exception("The selected release changed.");
                verifiedApk=finalApk;progress=100;phase="downloaded";error="";
            }
        }catch(Exception e){
            synchronized(this){phase="error";error="Update download failed: "+cleanError(e);progress=0;verifiedApk=null;}
        }finally{
            if(tmp!=null&&tmp.exists())tmp.delete();
            notifyChange();
        }
    }
    synchronized JSONObject requestInstall(){
        if(verifiedApk==null||!verifiedApk.isFile()){
            phase="error";error="Download and verify the APK first.";
            notifyChange();return state();
        }
        main.post(this::launchInstaller);
        return state();
    }
    private void launchInstaller(){
        try{
            File apk;
            String version;
            synchronized(this){
                if(verifiedApk==null||!verifiedApk.isFile())throw new Exception("Verified APK is missing.");
                apk=verifiedApk;version=candidate.version;
            }
            verifyApk(apk,version); // Verify again immediately before installation.
            if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){
                synchronized(this){error="Allow AUREL to install updates in Android settings, then return."; }
                notifyChange();
                Intent permission=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:"+activity.getPackageName()));
                activity.startActivityForResult(permission,UNKNOWN_SOURCES_REQUEST);
                return;
            }
            Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/apk");
            Intent intent=new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri,"application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent); // System installer always asks for confirmation.
            synchronized(this){error="";}notifyChange();
        }catch(Exception e){
            synchronized(this){phase="error";error="Could not launch Android installer: "+cleanError(e);}
            notifyChange();
        }
    }
    void onPermissionResult(){
        if(Build.VERSION.SDK_INT<26||activity.getPackageManager().canRequestPackageInstalls())
            launchInstaller();
        else{
            synchronized(this){error="Installation permission was not granted.";phase="downloaded";}
            notifyChange();
        }
    }
    void stop(){executor.shutdownNow();}

    private static String cleanError(Exception e){
        String s=e.getMessage();
        if(s==null||s.isEmpty())return "Unexpected network or file error.";
        return s.length()>240?s.substring(0,240):s;
    }
    private String installedVersion(){
        try{
            PackageInfo p=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0);
            return p.versionName==null?"0.0.0":p.versionName;
        }catch(Exception ignored){return "0.0.0";}
    }
    private static int[] parseVersion(String s){
        String[] parts=s.replaceFirst("-.*$","").split("\\.");
        int[] v=new int[]{0,0,0};
        for(int i=0;i<3&&i<parts.length;i++){
            try{v[i]=Integer.parseInt(parts[i]);}catch(Exception ignored){}
        }
        return v;
    }
    static int compareVersion(String a,String b){
        int[] x=parseVersion(a),y=parseVersion(b);
        for(int i=0;i<3;i++)if(x[i]!=y[i])return x[i]>y[i]?1:-1;
        return 0;
    }
    private void verifyApk(File file,String version)throws Exception{
        PackageManager pm=activity.getPackageManager();
        int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo archive=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);
        PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),flags);
        if(archive==null||!PKG.equals(archive.packageName)||!PKG.equals(installed.packageName))
            throw new Exception("APK package identifier does not match AUREL.");
        if(archive.versionName==null||!archive.versionName.equals(version))
            throw new Exception("APK version differs from selected release.");
        long next=Build.VERSION.SDK_INT>=28?archive.getLongVersionCode():archive.versionCode;
        long current=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode;
        if(next<=current)throw new Exception("APK versionCode must increase for Android updates.");
        Signature[] newSignatures=signatures(archive),oldSignatures=signatures(installed);
        if(newSignatures==null||newSignatures.length!=1||
           oldSignatures==null||oldSignatures.length!=1)
            throw new Exception("APK signing certificate is unavailable or ambiguous.");
        String incoming=hex(MessageDigest.getInstance("SHA-256").digest(newSignatures[0].toByteArray()));
        String existing=hex(MessageDigest.getInstance("SHA-256").digest(oldSignatures[0].toByteArray()));
        if(!CERT_SHA256.equals(incoming)||!CERT_SHA256.equals(existing))
            throw new Exception("AUREL signing certificate mismatch; installation blocked.");
    }
    private static Signature[] signatures(PackageInfo pkg){
        if(Build.VERSION.SDK_INT>=28)
            return pkg.signingInfo==null?null:pkg.signingInfo.getApkContentsSigners();
        return pkg.signatures;
    }
    private static String hex(byte[] value){
        StringBuilder s=new StringBuilder(value.length*2);
        for(byte b:value)s.append(String.format(Locale.ROOT,"%02X",b&255));
        return s.toString();
    }
    private static boolean trustedHost(String host){
        if(host==null)return false;
        String h=host.toLowerCase(Locale.ROOT);
        return h.equals("api.github.com")||h.equals("github.com")||h.endsWith(".githubusercontent.com");
    }
    private static HttpURLConnection open(String input)throws Exception{
        URL url=new URL(input);
        for(int redirects=0;redirects<7;redirects++){
            if(!url.getProtocol().equalsIgnoreCase("https")||!trustedHost(url.getHost()))
                throw new Exception("Untrusted update download URL.");
            HttpURLConnection c=(HttpURLConnection)url.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(10000);c.setReadTimeout(18000);
            c.setRequestProperty("User-Agent","AUREL-Hi-Res-Android-Updater");
            c.setRequestProperty("Accept","application/vnd.github+json,application/octet-stream;q=0.9,*/*;q=0.1");
            int response=c.getResponseCode();
            if(response>=300&&response<=308&&response!=304){
                String location=c.getHeaderField("Location");
                c.disconnect();
                if(location==null)throw new Exception("Release download redirect has no location.");
                url=new URL(url,location);
                continue;
            }
            if(response!=200){c.disconnect();throw new Exception("GitHub returned HTTP "+response);}
            return c;
        }
        throw new Exception("Too many release URL redirects.");
    }
    private static byte[] readSmall(String url,int limit)throws Exception{
        HttpURLConnection c=open(url);
        try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[8192];int count;
            while((count=in.read(buf))!=-1){
                if(out.size()+count>limit)throw new Exception("GitHub release response too large.");
                out.write(buf,0,count);
            }
            return out.toByteArray();
        }finally{c.disconnect();}
    }
}
