package com.aurel.hires;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.Tracks;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.TransferListener;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * A small MediaPlayer-compatible facade backed by Media3 ExoPlayer.
 *
 * STREAMINFO is sniffed from the *same DataSource.read()* bytes ExoPlayer
 * consumes. This never opens a second HTTP request to Mornye/Zarz and never
 * uses the Qobuz catalogue quality as proof of the playing file's format.
 *
 * All facade operations/callbacks run on Android's main looper, except the
 * DataSource reader, whose one-time verified result is posted to that looper.
 */
@OptIn(markerClass = UnstableApi.class)
final class AurelMediaPlayer {
    interface PreparedListener { void onPrepared(AurelMediaPlayer p); }
    interface CompletionListener { void onCompletion(AurelMediaPlayer p); }
    interface ErrorListener { boolean onError(AurelMediaPlayer p, int what, int extra); }
    interface FormatListener { void onAudioFormat(Format format); }
    interface FlacListener { void onFlacInfo(RealStreamQualityProbe.Result result); }
    interface StateListener { void onPlaybackState(); }

    private final ExoPlayer exo;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean flacReported = new AtomicBoolean(false);
    private PreparedListener preparedListener;
    private CompletionListener completionListener;
    private ErrorListener errorListener;
    private FormatListener formatListener;
    private FlacListener flacListener;
    private StateListener stateListener;
    private String playbackUrl = "";
    private boolean preparedNotified = false;
    private boolean completedNotified = false;
    private boolean released = false;

    AurelMediaPlayer(Context context) {
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(12000)
            .setReadTimeoutMs(20000)
            .setAllowCrossProtocolRedirects(false);

        DataSource.Factory monitored = () -> new FirstBytesDataSource(
            http.createDataSource(), result -> main.post(() -> {
                if (!released && flacListener != null) flacListener.onFlacInfo(result);
            }), flacReported);

        exo = new ExoPlayer.Builder(context)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(monitored))
            .build();
        exo.setAudioAttributes(new androidx.media3.common.AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build(), true);

        exo.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (released) return;
                if (state == Player.STATE_READY && !preparedNotified) {
                    preparedNotified = true;
                    if (preparedListener != null) preparedListener.onPrepared(AurelMediaPlayer.this);
                } else if (state == Player.STATE_ENDED && !completedNotified) {
                    completedNotified = true;
                    if (completionListener != null) completionListener.onCompletion(AurelMediaPlayer.this);
                }
                if (stateListener != null) stateListener.onPlaybackState();
            }
            @Override public void onIsPlayingChanged(boolean isPlaying) {
                if (!released && stateListener != null) stateListener.onPlaybackState();
            }
            @Override public void onTracksChanged(Tracks tracks) {
                if (released || formatListener == null) return;
                for (Tracks.Group group : tracks.getGroups()) {
                    if (group.getType() != C.TRACK_TYPE_AUDIO) continue;
                    for (int i = 0; i < group.length; i++) {
                        if (group.isTrackSelected(i)) {
                            formatListener.onAudioFormat(group.getTrackFormat(i));
                            return;
                        }
                    }
                }
            }
            @Override public void onPlayerError(PlaybackException error) {
                if (!released && errorListener != null) {
                    // No stream URLs or credentials are included in UI errors.
                    errorListener.onError(AurelMediaPlayer.this, 1, error.errorCode);
                }
            }
        });
    }

    void setOnPreparedListener(PreparedListener callback) { preparedListener = callback; }
    void setOnCompletionListener(CompletionListener callback) { completionListener = callback; }
    void setOnErrorListener(ErrorListener callback) { errorListener = callback; }
    void setOnFormatListener(FormatListener callback) { formatListener = callback; }
    void setOnFlacListener(FlacListener callback) { flacListener = callback; }
    void setOnStateListener(StateListener callback) { stateListener = callback; }

    void setDataSource(String url) {
        if (url == null || !url.startsWith("https://"))
            throw new IllegalArgumentException("Only HTTPS playback URLs are accepted");
        playbackUrl = url;
    }

    void prepareAsync() {
        if (released || playbackUrl.isEmpty())
            throw new IllegalStateException("Media source is unavailable");
        preparedNotified = false;
        completedNotified = false;
        flacReported.set(false);
        exo.setMediaItem(MediaItem.fromUri(Uri.parse(playbackUrl)));
        exo.prepare();
    }

    void start() { if (!released) exo.play(); }
    void pause() { if (!released) exo.pause(); }
    boolean isPlaying() { return !released && exo.isPlaying(); }
    void seekTo(int positionMs) { if (!released) exo.seekTo(Math.max(0, positionMs)); }
    int getCurrentPosition() { return !released ? positiveMs(exo.getCurrentPosition()) : 0; }
    int getDuration() { return !released ? positiveMs(exo.getDuration()) : 0; }
    private static int positiveMs(long ms) {
        return ms == C.TIME_UNSET || ms < 0 ? 0 : (int) Math.min(Integer.MAX_VALUE, ms);
    }
    void reset() {
        if (!released) {
            exo.stop();
            exo.clearMediaItems();
        }
    }
    void release() {
        if (released) return;
        released = true;
        exo.release();
        preparedListener = null;
        completionListener = null;
        errorListener = null;
        formatListener = null;
        flacListener = null;
        stateListener = null;
        playbackUrl = "";
    }

    private interface HeaderCallback {
        void onFlac(RealStreamQualityProbe.Result result);
    }

    /**
     * Reads, passes through and inspects the exact bytes of the selected media
     * response. Neither playback bytes nor credentials are stored on disk.
     * All read offsets, including seeks, remain owned by the original source.
     */
    private static final class FirstBytesDataSource implements DataSource {
        private static final int MAX_PREFIX = 65536;
        private final DataSource upstream;
        private final HeaderCallback callback;
        private final AtomicBoolean reported;
        private final byte[] prefix = new byte[MAX_PREFIX];
        private int length = 0;
        private boolean inspecting = false;

        FirstBytesDataSource(DataSource upstream, HeaderCallback callback,
                             AtomicBoolean reported) {
            this.upstream = upstream;
            this.callback = callback;
            this.reported = reported;
        }

        @Override public long open(DataSpec spec) throws IOException {
            inspecting = spec.position == 0 && !reported.get();
            length = 0;
            return upstream.open(spec);
        }

        @Override public int read(byte[] bytes, int offset, int readLength) throws IOException {
            int count = upstream.read(bytes, offset, readLength);
            if (count > 0 && inspecting && !reported.get()) inspect(bytes, offset, count);
            return count;
        }

        private void inspect(byte[] bytes, int offset, int count) {
            int toCopy = Math.min(count, MAX_PREFIX - length);
            if (toCopy <= 0) { inspecting = false; return; }
            System.arraycopy(bytes, offset, prefix, length, toCopy);
            length += toCopy;
            if (length < 4) return;
            boolean flac = signature("fLaC");
            boolean id3 = signature("ID3");
            if (!flac && !id3) { inspecting = false; return; }
            if (length < 42) return;
            RealStreamQualityProbe.Result info =
                RealStreamQualityProbe.parse(java.util.Arrays.copyOf(prefix, length));
            if (info.verifiedFromBytes) {
                inspecting = false;
                if (reported.compareAndSet(false, true)) callback.onFlac(info);
            } else if (flac || length >= MAX_PREFIX) {
                inspecting = false;
            }
        }

        private boolean signature(String tag) {
            if (length < tag.length()) return false;
            for (int i = 0; i < tag.length(); i++)
                if (prefix[i] != (byte) tag.charAt(i)) return false;
            return true;
        }

        @Override public Uri getUri() { return upstream.getUri(); }
        @Override public Map<String, List<String>> getResponseHeaders() {
            return upstream.getResponseHeaders();
        }
        @Override public void addTransferListener(TransferListener listener) {
            upstream.addTransferListener(listener);
        }
        @Override public void close() throws IOException {
            inspecting = false;
            upstream.close();
        }
    }
}
