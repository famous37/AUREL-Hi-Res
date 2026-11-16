package com.aurel.hires;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Optional bounded inspection of the actual HTTPS audio URL. Never requests a
 * new Mornye/Zarz ticket, never downloads an audio file, and never changes
 * playback: only up to 16 KiB of the media response is read on a worker.
 */
final class StreamQualityProbe {
    private static final int MAX_HEADER=16384;
    private static final long MAX_MEDIA_SIZE=20_000_000_000L;
    static final class Result {
        final String codec, evidence;
        final int bitDepth, sampleRateHz, channels, frameBitrateKbps;
        final long fileSize, totalSamples;
        Result(String codec,String evidence,int bits,int rate,int channels,
               int frameBitrateKbps,long fileSize,long totalSamples){
            this.codec=codec;this.evidence=evidence;this.bitDepth=bits;
            this.sampleRateHz=rate;this.channels=channels;
            this.frameBitrateKbps=frameBitrateKbps;
            this.fileSize=fileSize;this.totalSamples=totalSamples;
        }
    }
    static Result inspect(String url){
        if(url==null||!url.startsWith("https://"))return null;
        String next=url;
        for(int redirects=0;redirects<3;redirects++){
            HttpURLConnection c=null;
            try{
                URL target=new URL(next);
                if(!"https".equalsIgnoreCase(target.getProtocol()))return null;
                c=(HttpURLConnection)target.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(2500);c.setReadTimeout(3200);
                c.setRequestProperty("Range","bytes=0-"+(MAX_HEADER-1));
                c.setRequestProperty("Accept-Encoding","identity");
                c.setRequestProperty("Accept","audio/*,*/*;q=0.1");
                int status=c.getResponseCode();
                if(status==301||status==302||status==303||status==307||status==308){
                    String location=c.getHeaderField("Location");
                    if(location==null||location.isEmpty())return null;
                    URL redirected=new URL(target,location);
                    if(!"https".equalsIgnoreCase(redirected.getProtocol()))return null;
                    next=redirected.toString();
                    continue;
                }
                if(status!=200&&status!=206)return null;
                String encoding=c.getContentEncoding();
                if(encoding!=null&&!encoding.isEmpty()&&
                   !"identity".equalsIgnoreCase(encoding))return null;
                long size=status==206?rangeTotal(c.getHeaderField("Content-Range")):c.getContentLengthLong();
                if(size<0||size>MAX_MEDIA_SIZE)size=0;
                byte[] header=new byte[MAX_HEADER];
                int count=0;
                try(InputStream in=c.getInputStream()){
                    while(count<header.length){
                        int got=in.read(header,count,header.length-count);
                        if(got<0)break;
                        if(got==0)break;
                        count+=got;
                    }
                }
                return parse(header,count,size);
            }catch(Exception ignored){
                return null; // Missing media headers never interrupt playback.
            }finally{
                if(c!=null)c.disconnect();
            }
        }
        return null;
    }
    private static long rangeTotal(String range){
        if(range==null)return 0;
        int slash=range.lastIndexOf('/');
        if(slash<0||slash==range.length()-1)return 0;
        try{
            long size=Long.parseLong(range.substring(slash+1).trim());
            return size>0&&size<=MAX_MEDIA_SIZE?size:0;
        }catch(Exception ignored){return 0;}
    }
    private static int u(byte[] data,int index){return data[index]&255;}
    private static boolean match(byte[] b,int pos,int n,String text){
        if(pos<0||pos+text.length()>n)return false;
        for(int j=0;j<text.length();j++)if(u(b,pos+j)!=(int)text.charAt(j))return false;
        return true;
    }
    private static int skipId3(byte[] b,int n){
        if(!match(b,0,n,"ID3"))return 0;
        if(n<10)return n;
        for(int j=6;j<=9;j++)if((u(b,j)&128)!=0)return n;
        long size=((long)u(b,6)<<21)|((long)u(b,7)<<14)|((long)u(b,8)<<7)|u(b,9);
        if((u(b,5)&0x10)!=0)size+=10; // ID3v2 footer.
        return (int)Math.min(n,10+size);
    }
    static Result parse(byte[] b,int n,long fileSize){
        if(b==null||n<=0)return null;
        n=Math.min(n,b.length);
        fileSize=fileSize>0&&fileSize<=MAX_MEDIA_SIZE?fileSize:0;
        int off=skipId3(b,n);
        Result flac=parseFlac(b,n,off,fileSize);
        if(flac!=null)return flac;
        Result wav=parseWav(b,n,fileSize);
        if(wav!=null)return wav;
        return parseMp3(b,n,off,fileSize);
    }
    private static Result parseFlac(byte[] b,int n,int offset,long size){
        if(!match(b,offset,n,"fLaC")||offset+8>n)return null;
        int block=offset+4;
        // FLAC requires STREAMINFO as the very first metadata block.
        if((u(b,block)&0x7f)!=0)return null;
        int length=(u(b,block+1)<<16)|(u(b,block+2)<<8)|u(b,block+3);
        if(length<34||block+4+length>n)return null;
        int p=block+4;
        int rate=(u(b,p+10)<<12)|(u(b,p+11)<<4)|(u(b,p+12)>>4);
        int channels=((u(b,p+12)>>1)&7)+1;
        int bits=(((u(b,p+12)&1)<<4)|(u(b,p+13)>>4))+1;
        long total=((long)(u(b,p+13)&15)<<32)|((long)u(b,p+14)<<24)|
            ((long)u(b,p+15)<<16)|((long)u(b,p+16)<<8)|u(b,p+17);
        if(rate<8000||rate>768000||bits<4||bits>32||channels<1||channels>8)return null;
        return new Result("FLAC","FLAC STREAMINFO",bits,rate,channels,0,size,total);
    }
    private static int le16(byte[] b,int p){return u(b,p)|(u(b,p+1)<<8);}
    private static long le32(byte[] b,int p){
        return ((long)u(b,p)|((long)u(b,p+1)<<8)|((long)u(b,p+2)<<16)|((long)u(b,p+3)<<24));
    }
    private static Result parseWav(byte[] b,int n,long size){
        if(n<44||!match(b,0,n,"RIFF")||!match(b,8,n,"WAVE"))return null;
        int pos=12;
        while(pos+8<=n){
            long len=le32(b,pos+4);
            if(len<0||len>Integer.MAX_VALUE||pos+8+len>n)break;
            if(match(b,pos,n,"fmt ")&&len>=16){
                int type=le16(b,pos+8),channels=le16(b,pos+10),rate=(int)le32(b,pos+12),bits=le16(b,pos+22);
                if((type==1||type==3)&&channels>=1&&channels<=32&&rate>=8000&&rate<=768000&&bits>=8&&bits<=64)
                    return new Result(type==3?"WAV Float":"WAV PCM","WAVE fmt",bits,rate,channels,0,size,0);
                return null;
            }
            pos+=8+(int)len+((len&1)!=0?1:0);
        }
        return null;
    }
    private static Result parseMp3(byte[] b,int n,int start,long size){
        // A single MP3 frame may be VBR: only a frame bitrate is reported,
        // never a verified whole-track average or lossless bit depth.
        final int[] one={0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0};
        final int[] two={0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0};
        for(int i=start;i+4<n&&i<start+4096;i++){
            if(u(b,i)!=255||(u(b,i+1)&0xe0)!=0xe0)continue;
            int version=(u(b,i+1)>>3)&3,layer=(u(b,i+1)>>1)&3;
            int idx=(u(b,i+2)>>4)&15,srIndex=(u(b,i+2)>>2)&3;
            if(version==1||layer!=1||idx==0||idx==15||srIndex==3)continue;
            int rate=(version==3?new int[]{44100,48000,32000}[srIndex]:
                      version==2?new int[]{22050,24000,16000}[srIndex]:
                                 new int[]{11025,12000,8000}[srIndex]);
            int bitrate=(version==3?one[idx]:two[idx]);
            int frameSize=((version==3?144000:72000)*bitrate/rate)+((u(b,i+2)>>1)&1);
            int next=i+frameSize;
            if(next+3>=n||u(b,next)!=255||(u(b,next+1)&0xe0)!=0xe0||
                 ((u(b,next+1)>>1)&3)!=1||((u(b,next+1)>>3)&3)!=version)continue;
            int channels=((u(b,i+3)>>6)&3)==3?1:2;
            return new Result("MP3","MPEG frame header",0,rate,channels,bitrate,size,0);
        }
        return null;
    }
}
