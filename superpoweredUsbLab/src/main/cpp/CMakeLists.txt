cmake_minimum_required(VERSION 3.22.1)
project(aurel_superpowered_usb LANGUAGES CXX)
if(NOT EXISTS "${SUPERPOWERED_SDK_DIR}/SuperpoweredAndroidUSB.h")
    message(FATAL_ERROR "Official Superpowered evaluation SDK not installed.")
endif()
if(NOT EXISTS "${SUPERPOWERED_SDK_DIR}/libSuperpoweredAndroid${ANDROID_ABI}.a")
    message(FATAL_ERROR "Missing official SDK static archive for ${ANDROID_ABI}.")
endif()
add_library(aurel_superpowered_usb SHARED SuperpoweredUsbBridge.cpp)
target_include_directories(aurel_superpowered_usb PRIVATE "${SUPERPOWERED_SDK_DIR}")
target_compile_features(aurel_superpowered_usb PRIVATE cxx_std_17)
# Link to a PRIVATE LOCAL vendor SDK. Never copy this .a into the public repository.
target_link_libraries(aurel_superpowered_usb
    "${SUPERPOWERED_SDK_DIR}/libSuperpoweredAndroid${ANDROID_ABI}.a"
    log android OpenSLES)
