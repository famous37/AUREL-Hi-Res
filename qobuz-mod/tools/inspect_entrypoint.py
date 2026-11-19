#!/usr/bin/env python3
"""Print limited names of original entry points; no vendor source code is committed."""
import xml.etree.ElementTree as ET
import pathlib
import sys
root=pathlib.Path(sys.argv[1])
m=ET.parse(root/'AndroidManifest.xml').getroot()
an='{http://schemas.android.com/apk/res/android}'
print('package',m.attrib.get('package'))
for activity in m.iter():
    if activity.tag not in ('activity','activity-alias'): continue
    action_names=[e.attrib.get(an+'name','') for e in activity.iter('action')]
    if 'android.intent.action.MAIN' in action_names:
        print('LAUNCHER',activity.tag,activity.attrib.get(an+'name'),
              'target',activity.attrib.get(an+'targetActivity'))
    if 'qobuz' in repr(action_names).lower(): print('ACTIVITY',activity.attrib.get(an+'name'),action_names[:3])
print('SMALI_DIRS',[x.name for x in root.iterdir() if x.name.startswith('smali')])
for name in ['com/qobuz/android/data/remote/qws/dto/QWSAuthDto.smali',
             'com/qobuz/android/data/remote/oauth/dto/OAuthLoginDto.smali']:
    hits=list(root.glob('smali*/'+name))
    print('MODEL',name,str(hits[0]) if hits else 'NOT_FOUND')
