package com.aurel.usblab;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbManager;

/**
 * Explicit, non-exported destination for a mutable USB permission PendingIntent.
 * Forward only to this app's registered Activity receiver. The Activity checks
 * EXTRA_PERMISSION_GRANTED *and* UsbManager.hasPermission() before opening USB.
 */
public final class UsbPermissionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent original){
        if(original==null ||
           !"com.aurel.usblab.USB_PERMISSION".equals(original.getAction()))return;
        Intent callback=new Intent("com.aurel.usblab.USB_PERMISSION_CALLBACK")
            .setPackage(context.getPackageName());
        callback.putExtra(UsbManager.EXTRA_DEVICE,
            original.getParcelableExtra(UsbManager.EXTRA_DEVICE));
        callback.putExtra(UsbManager.EXTRA_PERMISSION_GRANTED,
            original.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false));
        context.sendBroadcast(callback);
    }
}
