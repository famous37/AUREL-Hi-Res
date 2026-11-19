package com.qobuz.mod;

import android.app.Activity;
import android.app.Application;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyStore;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * An optional, independent Qobuz legacy API 0.2 token panel.
 * It NEVER forges or substitutes the original Qobuz OAuth/QWS session.
 * Registered activity callbacks keep the panel reachable after navigation.
 */
public final class TokenGate {
    private static final String BUTTON_TAG = "qobuz_mod_token_overlay_v2";
    private static final String KEY_ALIAS = "qobuz_mod_token_key_v2";
    private static final String PREFS = "qobuz_mod_token_encrypted_v2";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static volatile boolean registered;
    private static Application app;

    private TokenGate() {}

    /** Called by a minimal Smali hook in launcher/onboarding/home onCreate. */
    public static synchronized void attach(Activity activity) {
        try {
            if (activity == null || activity.isFinishing()) return;
            if (!registered) {
                app = activity.getApplication();
                app.registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
                    @Override public void onActivityCreated(Activity a, Bundle b) { }
                    @Override public void onActivityStarted(Activity a) { }
                    @Override public void onActivityResumed(Activity a) { showAfterResume(a); }
                    @Override public void onActivityPaused(Activity a) { }
                    @Override public void onActivityStopped(Activity a) { }
                    @Override public void onActivitySaveInstanceState(Activity a, Bundle b) { }
                    @Override public void onActivityDestroyed(Activity a) { }
                });
                registered = true;
            }
            showAfterResume(activity);
        } catch (Throwable ignored) {
            // A failure in this OPTIONAL panel must never crash the original Qobuz app.
        }
    }

    private static int dp(Context ctx, float val) {
        return (int) (val * ctx.getResources().getDisplayMetrics().density + 0.5f);
    }

    private static void showAfterResume(final Activity a) {
        if (a == null) return;
        MAIN.postDelayed(() -> installButton(a), 100);
        MAIN.postDelayed(() -> installButton(a), 800);
    }

    private static void installButton(Activity activity) {
        try {
            if (activity.isFinishing() || activity.isDestroyed()) return;
            View decor = activity.getWindow().getDecorView();
            if (!(decor instanceof FrameLayout)) return;
            FrameLayout frame = (FrameLayout) decor;
            View prior = frame.findViewWithTag(BUTTON_TAG);
            if (prior != null) {
                prior.bringToFront();
                return;
            }

            Button button = new Button(activity);
            button.setTag(BUTTON_TAG);
            button.setText("TOKEN");
            button.setTextColor(Color.WHITE);
            button.setAllCaps(false);
            button.setTextSize(13);
            button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            button.setMinHeight(0);
            button.setMinimumHeight(0);
            button.setMinWidth(0);
            button.setMinimumWidth(0);
            button.setPadding(dp(activity, 16), 0, dp(activity, 16), 0);
            button.setElevation(dp(activity, 12));
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.rgb(46, 46, 56));
            bg.setCornerRadius(dp(activity, 14));
            bg.setStroke(dp(activity, 1), Color.rgb(105, 105, 117));
            button.setBackground(bg);

            int statusBarTop = dp(activity, 32);
            if (Build.VERSION.SDK_INT >= 23 && decor.getRootWindowInsets() != null) {
                WindowInsets wi = decor.getRootWindowInsets();
                statusBarTop = Math.max(statusBarTop, wi.getSystemWindowInsetTop());
            }
            // DecorView may draw edge-to-edge. Keep clear of status icons / cutouts.
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    dp(activity, 94), dp(activity, 44),
                    Gravity.TOP | Gravity.RIGHT);
            lp.topMargin = statusBarTop + dp(activity, 20);
            lp.rightMargin = dp(activity, 18);
            frame.addView(button, lp);
            button.bringToFront();
            button.setOnClickListener(v -> showTokenDialog(activity));
        } catch (Throwable ignored) {
            // Never break the host.
        }
    }

    private static TextView help(Context ctx, String text, boolean strong) {
        TextView t = new TextView(ctx);
        t.setText(text);
        t.setTextColor(strong ? Color.WHITE : Color.rgb(176, 176, 188));
        t.setTextSize(strong ? 16 : 13);
        t.setPadding(dp(ctx, 2), dp(ctx, 12), dp(ctx, 2), dp(ctx, 6));
        return t;
    }

    private static EditText input(Context ctx, LinearLayout container,
                                  String label, String value, boolean secret, boolean numeric) {
        container.addView(help(ctx, label, false));
        EditText t = new EditText(ctx);
        t.setSingleLine(true);
        t.setTextColor(Color.BLACK);
        t.setHintTextColor(Color.DKGRAY);
        t.setText(value == null ? "" : value);
        t.setTextSize(15);
        t.setSelectAllOnFocus(false);
        if (secret) t.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        else if (numeric) t.setInputType(InputType.TYPE_CLASS_NUMBER);
        else t.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        t.setPadding(dp(ctx, 10), dp(ctx, 8), dp(ctx, 10), dp(ctx, 8));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.rgb(242, 242, 245));
        bg.setCornerRadius(dp(ctx, 8));
        t.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(ctx, 48));
        container.addView(t, lp);
        return t;
    }

    private static void showTokenDialog(Activity activity) {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        LinearLayout fields = new LinearLayout(activity);
        fields.setOrientation(LinearLayout.VERTICAL);
        fields.setPadding(dp(activity, 20), dp(activity, 6),
                          dp(activity, 20), dp(activity, 18));
        fields.addView(help(activity,
                "Це перевірка токена через Qobuz API 0.2. Вона не входить до штатної OAuth/QWS-сесії плеєра.",
                false));

        EditText token = input(activity, fields, "USER AUTH TOKEN", load(activity, "token"), true, false);
        EditText userId = input(activity, fields, "USER ID", load(activity, "userId"), false, true);
        EditText appId = input(activity, fields, "APP ID", load(activity, "appId"), false, true);
        EditText appSecret = input(activity, fields, "APP SECRET (необов’язково)",
                                  load(activity, "appSecret"), true, false);
        TextView state = help(activity, "", false);
        fields.addView(state);
        ScrollView scroll = new ScrollView(activity);
        scroll.setFillViewport(false);
        scroll.addView(fields);

        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("Qobuz · токенний доступ")
                .setView(scroll)
                .setPositiveButton("Перевірити", null)
                .setNegativeButton("Закрити", (d, which) -> { })
                .setNeutralButton("Очистити", null)
                .create();
        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                final String t = token.getText().toString().trim();
                final String u = userId.getText().toString().trim();
                final String id = appId.getText().toString().trim();
                final String sec = appSecret.getText().toString().trim();
                if (t.length() < 12 || !u.matches("[0-9]{1,20}")
                        || !id.matches("[0-9]{6,15}")) {
                    state.setText("Введіть повний токен, числовий User ID і App ID.");
                    return;
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                state.setText("Перевіряю токен у Qobuz…");
                new Thread(() -> {
                    final String error = validate(id, u, t);
                    MAIN.post(() -> {
                        if (activity.isFinishing() || activity.isDestroyed()) return;
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                        if (error == null) {
                            try {
                                save(activity, "token", t);
                                save(activity, "userId", u);
                                save(activity, "appId", id);
                                save(activity, "appSecret", sec);
                                state.setText("API-токен підтверджено й захищено збережено. "
                                        + "Це НЕ вхід у штатний плеєр Qobuz.");
                                Toast.makeText(activity, "API-токен збережено", Toast.LENGTH_LONG).show();
                            } catch (Exception e) {
                                state.setText("Помилка захищеного збереження.");
                            }
                        } else {
                            state.setText(error);
                        }
                    });
                }, "QobuzModTokenVerify").start();
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
                activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
                token.setText(""); userId.setText(""); appId.setText(""); appSecret.setText("");
                state.setText("Локально збережені токени видалено.");
            });
        });
        dialog.show();
    }

    /** Null means a successful authenticated favorites request, not OAuth session conversion. */
    private static String validate(String appId, String uid, String token) {
        HttpURLConnection c = null;
        try {
            String endpoint = "https://www.qobuz.com/api.json/0.2/favorite/getUserFavorites"
                    + "?type=albums&limit=1&user_id=" + uid + "&app_id=" + appId;
            c = (HttpURLConnection) new URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("X-App-Id", appId);
            c.setRequestProperty("X-User-Auth-Token", token);
            c.setRequestProperty("Accept", "application/json");
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(12000);
            c.setReadTimeout(12000);
            int status = c.getResponseCode();
            if (status == 401 || status == 403) return "Qobuz відхилив токен (HTTP " + status + ").";
            if (status < 200 || status >= 300)
                return "Qobuz API повернув HTTP " + status + ".";
            InputStream stream = c.getInputStream();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buf = new byte[2048];
            int n;
            while ((n = stream.read(buf)) != -1 && bytes.size() < 131072) bytes.write(buf, 0, n);
            stream.close();
            JSONObject json = new JSONObject(bytes.toString("UTF-8"));
            if (json.has("error") || "error".equalsIgnoreCase(json.optString("status")))
                return "Qobuz API повернув помилку авторизації.";
            if (!json.has("albums") && !json.has("items") && !json.has("favorites"))
                return "Сервер відповів, але профіль не підтверджено.";
            return null;
        } catch (Exception e) {
            return "Не вдалося перевірити токен через мережу. Перевірте інтернет та App ID.";
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static SecretKey secureKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(KEY_ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256).build());
            kg.generateKey();
        }
        return (SecretKey) ks.getKey(KEY_ALIAS, null);
    }

    private static void save(Context ctx, String name, String val) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secureKey());
        byte[] data = cipher.doFinal(val.getBytes("UTF-8"));
        String encoded = android.util.Base64.encodeToString(cipher.getIV(), android.util.Base64.NO_WRAP)
                + ":" + android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(name, encoded).apply();
    }

    private static String load(Context ctx, String name) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String encrypted = prefs.getString(name, "");
            if (encrypted == null || !encrypted.contains(":")) return "";
            String[] parts = encrypted.split(":", 2);
            byte[] iv = android.util.Base64.decode(parts[0], android.util.Base64.NO_WRAP);
            byte[] bytes = android.util.Base64.decode(parts[1], android.util.Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secureKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(bytes), "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }
}
