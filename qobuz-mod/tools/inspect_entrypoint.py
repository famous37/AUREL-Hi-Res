#!/usr/bin/env python3
"""Inspect minimal decompiled entrypoint and auth DTO names; no source is committed."""
import pathlib
import sys
root=pathlib.Path(sys.argv[1])
print('SMALI_DIRS',[x.name for x in root.iterdir() if x.name.startswith('smali')])
targets=[
'com/qobuz/android/mobile/app/screen/launch/LauncherActivity.smali',
'com/qobuz/android/data/remote/qws/dto/QWSAuthDto.smali',
'com/qobuz/android/data/remote/oauth/dto/OAuthLoginDto.smali']
for name in targets:
 hits=list(root.glob('smali*/'+name))
 print('CLASS',name,'FOUND' if hits else 'MISSING')
 if not hits:continue
 lines=hits[0].read_text(errors='replace').splitlines()
 if 'LauncherActivity' in name:
  for i,line in enumerate(lines):
   if '.method' in line and any(w in line for w in ['onCreate','onResume','onStart']):
    print('METHOD',i+1,line)
    for y in lines[i:min(i+32,len(lines))]:print('CODE',y[:200])
 else:
  for line in lines:
   if '.field' in line or '.method' in line and any(x in line for x in ['getApiToken','getQwsToken','getAccessToken','getRefreshToken']):
    print('MODEL_DEF',line[:200])
