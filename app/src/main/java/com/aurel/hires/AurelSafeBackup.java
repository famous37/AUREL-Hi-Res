package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.Date;

/** User-picked Android SAF JSON backup; never exports SecureStore, tokens or media URLs. */
final class AurelSafeBackup {
    static final int REQUEST_EXPORT=4711,REQUEST_IMPORT=4712;
    private static final int MAX_BYTES=360*1024;
    private static final Set<String> ALLOWED=new HashSet<>(Arrays.asList(
        "aurel_locale_v1","aurel_palette_artwork_v1","aurel_palette_colors_v1",
        "aurel_motion_mode_v1","aurel_page_buffer_pref_v1",
        "aurel_cover_rhythm_v1","aurel_aurora_shadows_v1",
        "aurel_recent_searches","aurel_navigation_v2",
        "aurel_listening_history_v1"
    ));
    private String awaitingExport=null;
    private boolean awaitingImport=false;

    private static JSONObject validate(String content)throws Exception {
        if(content==null||content.isEmpty()||
           content.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)
            throw new Exception("Backup exceeds safe file size");
        JSONObject root=new JSONObject(content);
        if(!"aurel-safe-backup-v1".equals(root.optString("format")))
            throw new Exception("Unsupported AUREL backup format");
        JSONObject entries=root.optJSONObject("data");
        if(entries==null)throw new Exception("Backup has no settings");
        Iterator<String> keys=entries.keys();
        while(keys.hasNext()){
            String key=keys.next();
            if(!ALLOWED.contains(key))throw new Exception("Backup contains an unsupported field");
            Object value=entries.opt(key);
            if(!(value instanceof String)||((String)value).length()>180000)
                throw new Exception("Invalid backup setting");
        }
        if(entries.length()>ALLOWED.size())throw new Exception("Too many backup fields");
        return root;
    }
    void exportPicker(Activity activity,String content)throws Exception {
        validate(content);
        if(awaitingExport!=null||awaitingImport)throw new Exception("Finish the current backup first");
        awaitingExport=content;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        String stamp=new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());
        intent.putExtra(Intent.EXTRA_TITLE,"AUREL-Backup-"+stamp+".json");
        try{activity.startActivityForResult(intent,REQUEST_EXPORT);}
        catch(RuntimeException e){awaitingExport=null;throw e;}
    }
    void importPicker(Activity activity)throws Exception {
        if(awaitingExport!=null||awaitingImport)throw new Exception("Finish the current backup first");
        awaitingImport=true;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        try{activity.startActivityForResult(intent,REQUEST_IMPORT);}
        catch(RuntimeException e){awaitingImport=false;throw e;}
    }
    JSONObject finish(Activity activity,int request,int result,Intent data){
        final boolean exporting=request==REQUEST_EXPORT;
        String content=awaitingExport;
        awaitingExport=null;awaitingImport=false;
        JSONObject reply=new JSONObject();
        try {
            reply.put("kind",exporting?"export":"import");
            if(result!=Activity.RESULT_OK||data==null||data.getData()==null)
                return reply.put("ok",false).put("cancelled",true);
            Uri uri=data.getData();
            if(exporting){
                if(content==null)throw new Exception("Backup session expired");
                byte[] bytes=content.getBytes(StandardCharsets.UTF_8);
                if(bytes.length>MAX_BYTES)throw new Exception("Backup exceeds safe file size");
                try(OutputStream stream=activity.getContentResolver().openOutputStream(uri,"wt")){
                    if(stream==null)throw new Exception("Cannot open the selected document");
                    stream.write(bytes);stream.flush();
                }
                return reply.put("ok",true).put("message","Backup saved");
            }
            byte[] bytes;
            try(InputStream stream=activity.getContentResolver().openInputStream(uri);
                ByteArrayOutputStream output=new ByteArrayOutputStream()){
                if(stream==null)throw new Exception("Cannot read selected document");
                byte[] buf=new byte[4096];int n;
                while((n=stream.read(buf))!=-1){
                    if(output.size()+n>MAX_BYTES)throw new Exception("Backup is too large");
                    output.write(buf,0,n);
                }
                bytes=output.toByteArray();
            }
            String backup=new String(bytes,StandardCharsets.UTF_8);
            validate(backup);
            return reply.put("ok",true).put("content",backup);
        }catch(Exception error){
            try{return reply.put("ok",false).put("message",
                error.getMessage()==null?"Backup file error":error.getMessage());}
            catch(Exception ignored){return new JSONObject();}
        }
    }
}
