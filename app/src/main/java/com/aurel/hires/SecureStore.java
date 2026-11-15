package com.aurel.hires;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Secrets are encrypted at rest via AndroidKeyStore; never embedded in the APK. */
final class SecureStore {
    private static final String ALIAS = "aurel-qobuz-local-v1";
    private final SharedPreferences prefs;
    SecureStore(Context context) {
        prefs = context.getSharedPreferences("aurel_secure_v1", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry)ks.getEntry(ALIAS,null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return kg.generateKey();
    }
    synchronized void put(String name, String value) throws Exception {
        if (value == null || value.isEmpty()) { prefs.edit().remove(name).apply(); return; }
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = c.doFinal(value.getBytes(StandardCharsets.UTF_8));
        prefs.edit().putString(name,Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+
                Base64.encodeToString(encrypted,Base64.NO_WRAP)).apply();
    }
    synchronized String get(String name) {
        String value=prefs.getString(name, "");
        if(value.isEmpty()) return "";
        try {
            String[] parts=value.split(":",2);
            Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE,key(),
                    new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
            return new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
        } catch(Exception ignored) {return "";}
    }
    synchronized void clear() { prefs.edit().clear().apply(); }
}
