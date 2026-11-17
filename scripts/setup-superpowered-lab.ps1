$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dest = Join-Path $root 'vendor/superpowered-sdk'
$pin = '6198239d1e96c18c87c40dd7236d70d41c21921c'
$url = 'https://github.com/superpoweredSDK/Low-Latency-Android-iOS-Linux-Windows-tvOS-macOS-Interactive-Audio-Platform.git'
if (!(Test-Path (Join-Path $dest '.git'))) {
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  & git clone --filter=blob:none --sparse --no-checkout $url $dest
  if ($LASTEXITCODE -ne 0) { throw 'Could not clone official Superpowered SDK' }
}
& git -C $dest sparse-checkout set Superpowered
if ($LASTEXITCODE -ne 0) { throw 'Git sparse checkout failed' }
& git -C $dest fetch --depth=1 origin $pin
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch pinned Superpowered SDK commit' }
& git -C $dest checkout --detach $pin
if ($LASTEXITCODE -ne 0) { throw 'Could not check out pinned Superpowered SDK' }
$header = Join-Path $dest 'Superpowered/SuperpoweredAndroidUSB.h'
$library = Join-Path $dest 'Superpowered/libSuperpoweredAndroidarm64-v8a.a'
if (!(Test-Path $header) -or !(Test-Path $library)) {
  throw 'Official Superpowered USB header or arm64 library missing'
}
Write-Host 'Evaluation SDK installed locally and ignored by Git.'
Write-Host 'Run: gradle :superpoweredUsbLab:assembleDebug -PaurelSuperpoweredLab'
Write-Host 'Do not publicly distribute the resulting evaluation APK.'
