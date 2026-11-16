package com.aurel.hires;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Read-only URI for Android's system APK installer; never exposes arbitrary files. */
public final class AurelUpdateProvider extends ContentProvider {
    @Override public void attachInfo(android.content.Context context,ProviderInfo info){
        if(info.exported||!info.grantUriPermissions)
            throw new SecurityException("AUREL updater must be private with explicit URI grants.");
        super.attachInfo(context,info);
    }
    @Override public boolean onCreate(){return true;}
    private File getUpdate(Uri uri)throws FileNotFoundException{
        if(!"/apk".equals(uri.getPath()))throw new FileNotFoundException("Unsupported updater path.");
        File file=new File(getContext().getCacheDir(),"updates/aurel-update.apk");
        if(!file.isFile())throw new FileNotFoundException("No verified APK has been downloaded.");
        return file;
    }
    @Override public String getType(Uri uri){
        return "/apk".equals(uri.getPath())?"application/vnd.android.package-archive":null;
    }
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
        if(!"r".equals(mode))throw new FileNotFoundException("Read-only update provider.");
        return ParcelFileDescriptor.open(getUpdate(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){
        try{
            File f=getUpdate(uri);
            MatrixCursor result=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});
            result.addRow(new Object[]{"AUREL-Hi-Res-update.apk",f.length()});
            return result;
        }catch(FileNotFoundException e){return null;}
    }
    @Override public Uri insert(Uri uri,ContentValues v){throw new UnsupportedOperationException();}
    @Override public int update(Uri uri,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
    @Override public int delete(Uri uri,String s,String[] a){throw new UnsupportedOperationException();}
}
