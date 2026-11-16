package com.aurel.hires;
public final class StreamQualityProbeTest {
 static void eq(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static byte[] flac(int sample,int bits,int channels,long samples){
  byte[] b=new byte[64];
  b[0]='f';b[1]='L';b[2]='a';b[3]='C';
  b[4]=(byte)0x80;b[7]=34;
  long packed=(((long)sample&0xfffffL)<<44)|
    (((long)(channels-1)&7L)<<41)|(((long)(bits-1)&31L)<<36)|(samples&0xfffffffffL);
  for(int j=0;j<8;j++)b[18+j]=(byte)(packed >>> (56-j*8));
  return b;
 }
 public static void main(String[] args) {
  for(int rate:new int[]{44100,48000,96000,192000}){
   for(int bits:new int[]{16,24}){
    StreamQualityProbe.Result r=StreamQualityProbe.parse(flac(rate,bits,2,rate*200L),64,40_000_000L);
    eq(r!=null&&r.bitDepth==bits&&r.sampleRateHz==rate&&r.channels==2&&r.totalSamples==rate*200L,"FLAC "+rate+" "+bits);
    eq("FLAC STREAMINFO".equals(r.evidence)&&r.fileSize==40_000_000L,"FLAC stream evidence");
   }
  }
  byte[] id3=new byte[80];id3[0]='I';id3[1]='D';id3[2]='3';id3[9]=4;
  System.arraycopy(flac(96000,24,2,0),0,id3,14,64);
  eq(StreamQualityProbe.parse(id3,id3.length,0).bitDepth==24,"ID3-prefixed FLAC");
  byte[] bad=flac(96000,24,2,0);bad[7]=2;
  eq(StreamQualityProbe.parse(bad,bad.length,0)==null,"reject incomplete header");
  byte[] mp3=new byte[870];
  for(int pos:new int[]{0,417}){mp3[pos]=(byte)0xff;mp3[pos+1]=(byte)0xfb;mp3[pos+2]=(byte)0x90;mp3[pos+3]=(byte)0x64;}
  StreamQualityProbe.Result m=StreamQualityProbe.parse(mp3,mp3.length,0);
  eq(m!=null&&"MP3".equals(m.codec)&&m.sampleRateHz==44100&&m.frameBitrateKbps==128&&m.bitDepth==0,"MP3 frame only");
  eq(StreamQualityProbe.parse(new byte[160],160,0)==null,"no fabricated specs");
  System.out.println("StreamQualityProbe: FLAC/MP3 parsing and unknown-format tests passed");
 }
}