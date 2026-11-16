package com.aurel.hires;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Reads STREAMINFO bytes served by the final playback URL, not Qobuz
 * catalogue maxima or Android output-mixer properties.
 *
 * This is intentionally a SINGLE, bounded, best-effort HTTP range request.
 * Call asynchronously after playback starts: some gateway URLs are one-use,
 * and a second request may be rejected. Never block or retry playback.
 */
public final class RealStreamQualityProbe {
    private static final int MAX_BYTES = 64 * 1024;

    private RealStreamQualityProbe() {}

    public static final class Result {
        public final String codec;
        public final int bitsPerSample;
        public final int sampleRateHz;
        public final int channels;
        public final boolean verifiedFromBytes;

        private Result(String codec, int bits, int rate, int channels, boolean verified) {
            this.codec = codec;
            this.bitsPerSample = bits;
            this.sampleRateHz = rate;
            this.channels = channels;
            this.verifiedFromBytes = verified;
        }
    }

    public static Result probe(String playbackUrl) throws IOException {
        URL url = new URL(playbackUrl);
        if (!"https".equalsIgnoreCase(url.getProtocol()))
            throw new IOException("Audio source must use HTTPS");

        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(3000);
        connection.setReadTimeout(3000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Range", "bytes=0-65535");
        connection.setRequestProperty("Accept-Encoding", "identity");

        try {
            int status = connection.getResponseCode();
            if (status != 200 && status != 206)
                throw new IOException("Range request not supported");
            if (!"https".equalsIgnoreCase(connection.getURL().getProtocol()))
                throw new IOException("Insecure audio redirect");

            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream(128);
                byte[] chunk = new byte[512];
                while (out.size() < MAX_BYTES) {
                    int count = in.read(chunk, 0, Math.min(chunk.length, MAX_BYTES - out.size()));
                    if (count < 0) break;
                    out.write(chunk, 0, count);
                    if (out.size() >= 42) {
                        byte[] prefix = out.toByteArray();
                        if (startsWith(prefix, 0, "fLaC")) break;
                        if (!startsWith(prefix, 0, "ID3")) break;
                        int offset = id3PayloadEnd(prefix);
                        if (offset < 0 || offset > MAX_BYTES - 42) break;
                        if (prefix.length >= offset + 42) break;
                    }
                }
                return parse(out.toByteArray());
            }
        } finally {
            connection.disconnect();
        }
    }

    /** Pure parser of a native FLAC signature and first STREAMINFO metadata block. */
    public static Result parse(byte[] input) {
        if (input == null) return unknown();
        int offset = 0;
        if (startsWith(input, 0, "ID3")) {
            offset = id3PayloadEnd(input);
            if (offset < 0) return unknown();
        }
        if (!startsWith(input, offset, "fLaC") || input.length < offset + 42)
            return unknown();

        int metadata = offset + 4;
        int blockType = input[metadata] & 0x7f;
        int blockSize = ((input[metadata + 1] & 255) << 16)
            | ((input[metadata + 2] & 255) << 8) | (input[metadata + 3] & 255);
        if (blockType != 0 || blockSize != 34) return unknown();

        int streamInfo = metadata + 4 + 10;
        long packed = 0L;
        for (int i = 0; i < 8; i++)
            packed = (packed << 8) | (input[streamInfo + i] & 255L);
        int sampleRateHz = (int) ((packed >>> 44) & 0xfffffL);
        int channels = (int) ((packed >>> 41) & 7L) + 1;
        int bitsPerSample = (int) ((packed >>> 36) & 31L) + 1;
        if (sampleRateHz < 8000 || sampleRateHz > 768000 ||
            channels < 1 || channels > 8 || bitsPerSample < 4 || bitsPerSample > 32)
            return unknown();
        return new Result("FLAC", bitsPerSample, sampleRateHz, channels, true);
    }

    private static boolean startsWith(byte[] input, int offset, String signature) {
        if (offset < 0 || offset + signature.length() > input.length) return false;
        for (int i = 0; i < signature.length(); i++)
            if ((input[offset + i] & 255) != (int) signature.charAt(i)) return false;
        return true;
    }

    private static int id3PayloadEnd(byte[] input) {
        if (input.length < 10) return -1;
        int size = 0;
        for (int i = 6; i < 10; i++) {
            int digit = input[i] & 255;
            if ((digit & 128) != 0) return -1;
            size = (size << 7) | digit;
        }
        // ID3v2.4 may have an optional 10-byte footer. Do not assert a
        // FLAC header if the tag layout is not unambiguously parseable.
        if ((input[5] & 0x10) != 0) return -1;
        return 10 + size <= MAX_BYTES ? 10 + size : -1;
    }

    private static Result unknown() {
        return new Result("", 0, 0, 0, false);
    }
}
