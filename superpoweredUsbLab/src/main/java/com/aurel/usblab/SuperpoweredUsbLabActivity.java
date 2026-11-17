package com.aurel.usblab;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.graphics.Color;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

/**
 * Experimental, separate-package Superpowered USB audio test bench.
 *
 * Never accesses the production AUREL app's accounts, files or Android
 * MediaPlayer. No USB interface opens until the user taps Connect DAC.
 * Do not present Superpowered float PCM output as verified bit-perfect.
 */
public final class SuperpoweredUsbLabActivity extends Activity {
    private static final String USB_PERMISSION =
        "com.aurel.usblab.USB_PERMISSION";
    private static final String USB_PERMISSION_CALLBACK =
        "com.aurel.usblab.USB_PERMISSION_CALLBACK";
    private static final int PICK_AUDIO=92;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private UsbManager usbManager;
    private UsbDevice device;
    private UsbDeviceConnection connection;
    private TextView diagnostic;
    private TextView message;
    private Spinner rates;
    private Spinner depths;
    private File copiedFile;
    private int pendingFilePickerUsbId=-1;
    private boolean nativeReady=false,closing=false;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;

    private native boolean nativeInitialize(String evaluationKey,String cacheDir);
    private native int nativeConnect(int id,int fd,byte[] descriptors);
    private native boolean nativeStart(int rate,int bits,int mode);
    private native boolean nativeOpenFile(String absolutePath);
    private native void nativeToggle();
    private native void nativeStop();
    private native void nativeDisconnect(int id);
    private native void nativeShutdown();
    private native String nativePoll();

    private final Runnable updateStatus=new Runnable(){
        @Override public void run(){
            if(closing)return;
            if(nativeReady){
                try { diagnostic.setText(nativePoll()); }
                catch(Throwable problem){ diagnostic.setText("Native diagnostic unavailable"); }
            }
            handler.postDelayed(this,350L);
        }
    };

    private final BroadcastReceiver usbEvents=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent intent){
            if(intent==null)return;
            String action=intent.getAction();
            UsbDevice attached=intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if(USB_PERMISSION_CALLBACK.equals(action)){
                if(attached!=null &&
                    intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false))
                    connectGranted(attached);
                else say("USB permission denied. Android output remains unaffected.");
            }else if(UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)){
                if(device!=null&&attached!=null&&
                    attached.getDeviceId()==device.getDeviceId()){
                    releaseDevice();
                    say("USB DAC detached. Native transport stopped safely.");
                }
            }else if(UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(action)){
                say("USB DAC attached. Tap Connect DAC to request access.");
            }
        }
    };

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        usbManager=(UsbManager)getSystemService(USB_SERVICE);
        audioManager=(AudioManager)getSystemService(AUDIO_SERVICE);
        if(audioManager!=null)focusRequest=new AudioFocusRequest.Builder(
                AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener(focus->{
                if(focus==AudioManager.AUDIOFOCUS_LOSS ||
                   focus==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
                   focus==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK)
                    handler.post(()->{
                        if(nativeReady)nativeStop();
                        say("Audio focus interrupted. Restart the test manually.");
                    });
            },handler).build();
        createUi();
        IntentFilter events=new IntentFilter();
        events.addAction(USB_PERMISSION_CALLBACK);
        events.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        events.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        registerReceiver(usbEvents,events,Context.RECEIVER_NOT_EXPORTED);
        try{
            System.loadLibrary("aurel_superpowered_usb");
            nativeReady=nativeInitialize(
                "ExampleLicenseKey-WillExpire-OnNextUpdate",
                getCacheDir().getAbsolutePath());
            say(nativeReady?"SDK loaded. Connect a USB DAC to begin.":"Superpowered SDK initialization failed.");
        }catch(UnsatisfiedLinkError|RuntimeException error){
            say("Native SDK unavailable: "+error.getClass().getSimpleName());
        }
        handler.post(updateStatus);
    }

    private int dp(int value){return Math.round(getResources().getDisplayMetrics().density*value);}
    private TextView text(String title,int size){
        TextView view=new TextView(this);
        view.setText(title);
        view.setTextColor(Color.WHITE);
        view.setTextSize(size);
        view.setPadding(0,dp(6),0,dp(6));
        return view;
    }
    private Button button(String label,LinearLayout root,Runnable action){
        Button b=new Button(this);
        b.setText(label);b.setAllCaps(false);
        root.addView(b,new LinearLayout.LayoutParams(-1,-2));
        b.setOnClickListener(view->action.run());
        return b;
    }
    private void createUi(){
        ScrollView scroller=new ScrollView(this);
        scroller.setFillViewport(true);
        scroller.setBackgroundColor(Color.rgb(13,13,17));
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20),dp(20),dp(20),dp(34));
        scroller.addView(root);
        setContentView(scroller);
        root.addView(text("AUREL  /  USB LAB",25));
        root.addView(text("Experimental Superpowered native USB route • private evaluation only.",15));
        root.addView(text("Does NOT verify bit-perfect PCM. Start at low analog volume; some DACs play at full hardware level.",13));
        rates=new Spinner(this);
        ArrayAdapter<String> rateAdapter=new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_dropdown_item,
            new String[]{"44100 Hz","48000 Hz","96000 Hz","192000 Hz"});
        rates.setAdapter(rateAdapter);
        root.addView(text("USB target sample rate",16));
        root.addView(rates);
        depths=new Spinner(this);
        ArrayAdapter<String> bitAdapter=new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_dropdown_item,
            new String[]{"16-bit","24-bit"});
        depths.setAdapter(bitAdapter);
        root.addView(text("Requested USB PCM resolution",16));
        root.addView(depths);
        button("1  •  Connect DAC and request USB permission",root,this::connectFirstAudioDevice);
        button("2  •  Quiet 440 Hz USB test tone",root,()->startTest(1));
        button("3  •  Choose local WAV / AIFF / MP3 / AAC",root,this::pickLocalFile);
        button("Play / Pause",root,()->{
            if(nativeReady)nativeToggle();
        });
        button("Stop & release DAC",root,()->{
            releaseDevice();say("Native USB released. Connect again to test.");
        });
        message=text("No DAC connected.",15);
        root.addView(message);
        diagnostic=text("USB transport inactive.",14);
        diagnostic.setTextColor(Color.LTGRAY);
        root.addView(diagnostic);
        root.addView(text("Local FLAC and Qobuz streaming are not in this initial laboratory build; Superpowered AdvancedAudioPlayer does not list FLAC support.",13));
    }
    private void say(String text){if(message!=null)message.setText(text);}
    private static boolean hasUsbAudio(UsbDevice d){
        for(int i=0;i<d.getInterfaceCount();i++)
            if(d.getInterface(i).getInterfaceClass()==1)return true;
        return false;
    }
    private void connectFirstAudioDevice(){
        if(!nativeReady||usbManager==null){say("Native driver is unavailable.");return;}
        if(connection!=null){say("DAC already connected. Stop & release before selecting another.");return;}
        UsbDevice selected=null;
        for(UsbDevice d:usbManager.getDeviceList().values())
            if(hasUsbAudio(d)){selected=d;break;}
        if(selected==null){say("No USB Audio Class DAC detected.");return;}
        if(!usbManager.hasPermission(selected)){
            // Explicit PendingIntent target: Android 14+ forbids mutable
            // implicit PendingIntents and the broadcast must not be hijacked.
            Intent intent=new Intent(this,UsbPermissionReceiver.class)
                .setAction(USB_PERMISSION);
            PendingIntent pi=PendingIntent.getBroadcast(this,0,intent,
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
            usbManager.requestPermission(selected,pi);
            say("Android USB permission requested.");
        }else connectGranted(selected);
    }
    private void connectGranted(UsbDevice d){
        if(connection!=null||usbManager==null)return;
        if(!usbManager.hasPermission(d)||!hasUsbAudio(d)){say("USB audio permission is missing.");return;}
        UsbDeviceConnection opened=usbManager.openDevice(d);
        if(opened==null){say("Cannot open USB device. Android may own its interface.");return;}
        byte[] descriptors=opened.getRawDescriptors();
        if(descriptors==null||descriptors.length==0){opened.close();say("USB descriptors unavailable.");return;}
        try{
            int result=nativeConnect(d.getDeviceId(),opened.getFileDescriptor(),descriptors);
            if(result!=0&&result!=1){
                nativeDisconnect(d.getDeviceId());
                opened.close();
                say("Superpowered found no usable USB audio output (code "+result+").");
                return;
            }
            device=d;connection=opened;
            say("USB connected: "+d.getProductName()+". Start a quiet tone or select an audio file.");
        }catch(Throwable error){
            try{nativeDisconnect(d.getDeviceId());}catch(Throwable ignored){}
            opened.close();
            say("Native connect failed: "+error.getClass().getSimpleName());
        }
    }
    private int selectedRate(){
        int[] hz={44100,48000,96000,192000};
        return hz[Math.max(0,Math.min(hz.length-1,rates.getSelectedItemPosition()))];
    }
    private int selectedBits(){return depths.getSelectedItemPosition()==0?16:24;}
    private boolean requestFocus(){
        if(audioManager==null||focusRequest==null)return false;
        return audioManager.requestAudioFocus(focusRequest)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    private void dropFocus(){
        if(audioManager!=null&&focusRequest!=null)
            audioManager.abandonAudioFocusRequest(focusRequest);
    }
    private boolean startTest(int mode){
        if(!nativeReady||connection==null){say("Connect and authorize the DAC first.");return false;}
        if(!requestFocus()){say("Cannot acquire Android audio focus.");return false;}
        try{
            boolean ok=nativeStart(selectedRate(),selectedBits(),mode);
            if(!ok){dropFocus();say("DAC rejected USB streaming. Try 44.1 kHz / 16-bit.");return false;}
            say(mode==1?"Native USB: quiet 440 Hz tone started.":
                "Native USB started; waiting for selected media to open.");
            return true;
        }catch(Throwable error){
            dropFocus();say("USB test failed: "+error.getClass().getSimpleName());return false;
        }
    }
    private void pickLocalFile(){
        if(connection==null){say("Connect the DAC before selecting music.");return;}
        // Android backgrounds this Activity during the file picker. onStop()
        // must release the USB claim, so remember the device for reacquisition
        // after the picker returns. We never keep the DAC seized in background.
        pendingFilePickerUsbId=device.getDeviceId();
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        startActivityForResult(i,PICK_AUDIO);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=PICK_AUDIO)return;
        int reopenId=pendingFilePickerUsbId;
        pendingFilePickerUsbId=-1;
        if(result!=RESULT_OK||data==null||data.getData()==null){
            say("File selection cancelled. Tap Connect DAC to resume.");
            return;
        }
        if(connection==null&&reopenId>=0&&usbManager!=null){
            // USB permission lasts for this attachment, but check it again
            // before re-entering the experimental native driver.
            for(UsbDevice candidate:usbManager.getDeviceList().values()){
                if(candidate.getDeviceId()==reopenId && usbManager.hasPermission(candidate)){
                    connectGranted(candidate);
                    break;
                }
            }
        }
        if(connection==null){say("USB DAC disconnected while picking the file. Reconnect it.");return;}
        Uri uri=data.getData();
        String name="";
        try(Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},
                null,null,null)){
            if(c!=null&&c.moveToFirst())name=c.getString(0);
        }catch(RuntimeException ignored){}
        String ext="";
        int dot=name.lastIndexOf('.');
        if(dot>=0)ext=name.substring(dot).toLowerCase(java.util.Locale.ROOT);
        if(ext.equals(".flac")||"audio/flac".equalsIgnoreCase(getContentResolver().getType(uri))){
            say("FLAC is not supported by the vendor AdvancedAudioPlayer. Use WAV for this USB transport test.");
            return;
        }
        if(!ext.equals(".wav")&&!ext.equals(".aif")&&!ext.equals(".aiff")&&
           !ext.equals(".mp3")&&!ext.equals(".m4a")&&!ext.equals(".aac")){
            say("Choose a WAV, AIFF, MP3 or AAC file. FLAC requires a separate decoder.");
            return;
        }
        final String suffix=ext;
        say("Copying selected test audio to the private app cache...");
        new Thread(()->{
            File file=null;
            try{
                file=File.createTempFile("aurel-usb-lab-",suffix,getCacheDir());
                try(InputStream input=getContentResolver().openInputStream(uri);
                    FileOutputStream output=new FileOutputStream(file)){
                    if(input==null)throw new IllegalStateException("File not readable");
                    byte[] buffer=new byte[65536];long total=0;int n;
                    while((n=input.read(buffer))!=-1){
                        total+=n;
                        if(total>300L*1024*1024)throw new IllegalStateException("300 MB test limit exceeded");
                        output.write(buffer,0,n);
                    }
                }
                final File ready=file;
                handler.post(()->{
                    if(closing||connection==null){ready.delete();return;}
                    if(copiedFile!=null)copiedFile.delete();
                    copiedFile=ready;
                    if(startTest(2)){
                        if(!nativeOpenFile(ready.getAbsolutePath()))
                            say("Audio file open rejected by Superpowered.");
                        else say("Opening local file through Superpowered USB...");
                    }
                });
            }catch(Exception error){
                if(file!=null)file.delete();
                String reason=error.getMessage();
                handler.post(()->say("Cannot read test file: "+(reason==null?"Unknown reason":reason)));
            }
        },"AUREL-USB-Lab-FileCopy").start();
    }
    private void releaseDevice(){
        if(nativeReady){
            try{nativeStop();}catch(Throwable ignored){}
            if(device!=null)try{nativeDisconnect(device.getDeviceId());}catch(Throwable ignored){}
        }
        if(connection!=null)try{connection.close();}catch(RuntimeException ignored){}
        connection=null;device=null;dropFocus();
    }
    @Override protected void onStop(){
        releaseDevice(); // Never run the native USB session in the background.
        super.onStop();
    }
    @Override protected void onDestroy(){
        closing=true;handler.removeCallbacks(updateStatus);
        releaseDevice();
        unregisterReceiver(usbEvents);
        if(nativeReady){try{nativeShutdown();}catch(Throwable ignored){}}
        if(copiedFile!=null)copiedFile.delete();
        super.onDestroy();
    }
}
