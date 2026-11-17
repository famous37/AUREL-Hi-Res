#include <jni.h>
#include <android/log.h>
#include <Superpowered.h>
#include <SuperpoweredAndroidUSB.h>
#include <SuperpoweredAdvancedAudioPlayer.h>
#include <atomic>
#include <cmath>
#include <cstring>
#include <cstdint>
#include <memory>
#include <string>
#include <cstdio>

namespace {
constexpr unsigned int MaxFrames=8192;
constexpr float TwoPi=6.28318530718f;
std::unique_ptr<Superpowered::AdvancedAudioPlayer> player;
std::atomic<int> currentMode{0};          // 0=silence, 1=quiet tone, 2=file
std::atomic<bool> paused{false};
std::atomic<uint64_t> renderedFrames{0};
std::atomic<int> actualRate{0};
std::atomic<int> actualChannels{0};
std::atomic<int> lastEvent{0};
std::atomic<int> lastOpenError{0};
int deviceId=-1;
bool initialized=false;
bool running=false;
float phase=0.0f;
// processStereo requires an extra 64 bytes beyond 2 * numFrames floats.
// Static aligned scratch avoids heap allocation on the real-time USB thread.
alignas(64) float playerScratch[MaxFrames*2+16];

bool audioCallback(void *,int,float *audio,int frames,int samplerate,int,int outputs){
    if(!audio||frames<=0||outputs<2||frames>(int)MaxFrames)return false;
    actualRate.store(samplerate,std::memory_order_relaxed);
    actualChannels.store(outputs,std::memory_order_relaxed);
    if(outputs!=2)return false; // Do not risk incorrect interleaving on >2 channels.
    const int mode=currentMode.load(std::memory_order_relaxed);
    bool mute=paused.load(std::memory_order_relaxed);
    if(mode==1 && !mute){
        float increment=TwoPi*440.0f/float(samplerate);
        for(int n=0;n<frames;n++){
            // -36.5 dBFS. Safe DIGITAL level, but analog DAC gain is unknown.
            float sample=std::sin(phase)*0.015f;
            phase+=increment;if(phase>=TwoPi)phase-=TwoPi;
            audio[n*2]=sample;audio[n*2+1]=sample;
        }
        renderedFrames.fetch_add(frames,std::memory_order_relaxed);
        return true;
    }
    if(mode==2 && player){
        // Always process the player—even when paused—to complete async open().
        player->outputSamplerate=static_cast<unsigned int>(samplerate);
        bool produced=player->processStereo(playerScratch,false,
                                           static_cast<unsigned int>(frames),1.0f);
        if(produced && !mute){
            std::memcpy(audio,playerScratch,frames*2*sizeof(float));
            renderedFrames.fetch_add(frames,std::memory_order_relaxed);
            return true;
        }
        return false;
    }
    return false;
}
void stopNativeIO(){
    currentMode.store(0,std::memory_order_release);
    if(running && deviceId>=0)Superpowered::AndroidUSBAudio::stopIO(deviceId);
    running=false;
    paused.store(false);
}
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeInitialize(
    JNIEnv *env,jobject,jstring key,jstring directory) {
    if(!initialized){
        const char *k=env->GetStringUTFChars(key,nullptr);
        Superpowered::Initialize(k);
        env->ReleaseStringUTFChars(key,k);
        Superpowered::AndroidUSB::initialize(nullptr,nullptr,nullptr,nullptr,nullptr);
        initialized=true;
    }
    const char *cache=env->GetStringUTFChars(directory,nullptr);
    Superpowered::AdvancedAudioPlayer::setTempFolder(cache);
    env->ReleaseStringUTFChars(directory,cache);
    return JNI_TRUE;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeConnect(
    JNIEnv *env,jobject,jint id,jint fd,jbyteArray descriptor) {
    if(!initialized||deviceId>=0||!descriptor)return 3;
    jsize count=env->GetArrayLength(descriptor);
    if(count<=0)return 3;
    jbyte *bytes=env->GetByteArrayElements(descriptor,nullptr);
    auto result=Superpowered::AndroidUSB::onConnect(id,fd,
                    reinterpret_cast<unsigned char*>(bytes),count);
    env->ReleaseByteArrayElements(descriptor,bytes,JNI_ABORT);
    if(result==Superpowered::AudioAndMIDISuccess ||
       result==Superpowered::AudioSuccess)deviceId=id;
    return static_cast<jint>(result);
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeStart(
    JNIEnv *,jobject,jint rate,jint bits,jint mode) {
    if(deviceId<0 || (mode!=1&&mode!=2))return JNI_FALSE;
    if(rate!=44100&&rate!=48000&&rate!=96000&&rate!=192000)return JNI_FALSE;
    if(bits!=16&&bits!=24)return JNI_FALSE;
    stopNativeIO();
    player.reset(); // old USB callback is fully stopped before deleting its player
    player.reset(new Superpowered::AdvancedAudioPlayer(static_cast<unsigned int>(rate),0));
    player->timeStretching=false;
    player->playbackRate=1.0;
    phase=0;
    renderedFrames.store(0);actualRate.store(0);actualChannels.store(0);
    lastEvent.store(0);lastOpenError.store(0);
    currentMode.store(mode,std::memory_order_release);
    bool ok=Superpowered::AndroidUSBAudio::easyIO(
        deviceId,rate,bits,0,2,Superpowered::AndroidUSBAudioBufferSize_Mid,
        nullptr,audioCallback);
    if(!ok){currentMode.store(0);player.reset();return JNI_FALSE;}
    running=true;
    return JNI_TRUE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeOpenFile(
    JNIEnv *env,jobject,jstring path) {
    if(!running||currentMode.load()!=2||!player)return JNI_FALSE;
    const char *p=env->GetStringUTFChars(path,nullptr);
    // Only copied files inside this application's own cache are allowed.
    if(!p||std::strstr(p,"aurel-usb-lab-")==nullptr){
        if(p)env->ReleaseStringUTFChars(path,p);
        return JNI_FALSE;
    }
    player->open(p);
    env->ReleaseStringUTFChars(path,p);
    return JNI_TRUE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeToggle(JNIEnv *,jobject){
    if(!running)return;
    if(currentMode.load()==1)paused.store(!paused.load());
    else if(currentMode.load()==2&&player)player->togglePlayback();
}

extern "C" JNIEXPORT void JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeStop(JNIEnv *,jobject){
    stopNativeIO();
}

extern "C" JNIEXPORT void JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeDisconnect(
    JNIEnv *,jobject,jint id){
    if(deviceId==id){
        stopNativeIO();
        player.reset();
        Superpowered::AndroidUSB::onDisconnect(id);
        deviceId=-1;
        actualRate.store(0);actualChannels.store(0);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativeShutdown(JNIEnv *,jobject){
    stopNativeIO();
    player.reset();
    if(deviceId>=0){Superpowered::AndroidUSB::onDisconnect(deviceId);deviceId=-1;}
    // Vendor docs require AndroidUSB initialize/destroy once per PROCESS.
    // Keep the singleton initialized if the test Activity is recreated.
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_aurel_usblab_SuperpoweredUsbLabActivity_nativePoll(JNIEnv *env,jobject){
    if(player && currentMode.load()==2 && running){
        auto event=player->getLatestEvent();
        if(event!=Superpowered::AdvancedAudioPlayer::PlayerEvent_None &&
           event!=Superpowered::AdvancedAudioPlayer::PlayerEvent_Opening)
            lastEvent.store(static_cast<int>(event));
        if(event==Superpowered::AdvancedAudioPlayer::PlayerEvent_Opened)
            player->play();
        else if(event==Superpowered::AdvancedAudioPlayer::PlayerEvent_OpenFailed)
            lastOpenError.store(player->getOpenErrorCode());
    }
    char output[480];
    const char *transport=running?"USB engine active":"USB engine inactive";
    const char *mode=currentMode.load()==1?"440 Hz test":
                     currentMode.load()==2?"File playback":"Stopped";
    int event=lastEvent.load();
    double pos=player&&running?player->getDisplayPositionMs()/1000.0:0;
    double duration=player&&running?player->getDurationMs()/1000.0:0;
    snprintf(output,sizeof(output),
        "%s | %s\nUSB output: %d Hz, %d channels\n"
        "USB frames rendered: %llu\nFile position %.1fs / %.1fs\n"
        "File event: %d | open error: %d\n"
        "PCM identity: NOT verified; Superpowered uses float32 I/O.",
        transport,mode,actualRate.load(),actualChannels.load(),
        static_cast<unsigned long long>(renderedFrames.load()),
        pos,duration,event,lastOpenError.load());
    return env->NewStringUTF(output);
}
