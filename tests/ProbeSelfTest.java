package com.aurel.hires;

/** Executable pure-Java regression tests; no Android SDK or network needed. */
public final class ProbeSelfTest {
    private static byte[] flac(int hz, int bits, int channels) {
        byte[] b = new byte[42];
        b[0] = 'f'; b[1] = 'L'; b[2] = 'a'; b[3] = 'C';
        b[4] = (byte) 0x80; // Last metadata block, type STREAMINFO
        b[7] = 34; // STREAMINFO is 34 bytes
        long packed = (((long) hz & 0xfffffL) << 44)
            | (((long) channels - 1L) << 41)
            | (((long) bits - 1L) << 36)
            | 123456L;
        for (int i = 7; i >= 0; i--) {
            b[18 + i] = (byte) (packed & 255);
            packed >>>= 8;
        }
        return b;
    }

    private static void verify(int hz, int bits, int channels) {
        RealStreamQualityProbe.Result result =
            RealStreamQualityProbe.parse(flac(hz, bits, channels));
        if (!result.verifiedFromBytes || !"FLAC".equals(result.codec)
            || result.sampleRateHz != hz || result.bitsPerSample != bits
            || result.channels != channels)
            throw new AssertionError("Invalid FLAC decode: " + hz + "/" + bits);
    }

    private static void reject(byte[] bytes) {
        if (RealStreamQualityProbe.parse(bytes).verifiedFromBytes)
            throw new AssertionError("Parser accepted an invalid source");
    }

    public static void main(String[] args) {
        verify(44100, 16, 2);
        verify(48000, 24, 2);
        verify(96000, 24, 2);
        verify(192000, 24, 2);
        verify(48000, 32, 6);
        reject(null);
        reject(new byte[]{'M', 'P', '3'});
        reject(new byte[]{});
        byte[] badBlock = flac(96000, 24, 2);
        badBlock[7] = 33;
        reject(badBlock);
        byte[] badRate = flac(96000, 24, 2);
        for (int i = 18; i < 26; i++) badRate[i] = 0;
        reject(badRate);
        System.out.println("PASS: FLAC STREAMINFO parsing and invalid-header rejection");
    }
}
