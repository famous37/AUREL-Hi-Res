#!/usr/bin/env python3
"""Diagnostic-only Qobuz auth wiring audit; do not print tokens or hard-coded secrets."""
import pathlib, re, sys, collections
root = pathlib.Path(sys.argv[1])
expected = [
 'com/qobuz/android/data/remote/oauth/dto/OAuthLoginDto.smali',
 'com/qobuz/android/data/remote/oauth/dto/OAuthDto.smali',
 'com/qobuz/android/data/remote/qws/dto/QWSAuthDto.smali',
 'com/qobuz/android/data/remote/qws/dto/QWSAuthTokenDto.smali',
]
for item in expected:
 hits=list(root.glob('smali*/'+item))
 print('=== AUTH DATA MODEL ===',item, 'found',len(hits))
 if not hits: continue
 lines=hits[0].read_text(errors='replace').splitlines()
 for i,line in enumerate(lines):
  if line.startswith('.field') or line.startswith('.method') or line.startswith('.annotation runtime Lcom/squareup/moshi/JsonClass;'):
   print('%4d'% (i+1),line[:190])
 print('---')
keys=('QWSAuthDto;','OAuthLoginDto;','QWSAuthTokenDto;','OAuthDto;')
matches=[]
for folder in root.glob('smali*'):
 for file in folder.rglob('*.smali'):
  if '/dto/' in str(file) and any(q in str(file) for q in ('JsonAdapter','Dto.smali')): continue
  try:
   lines=file.read_text(errors='replace').splitlines()
  except Exception: continue
  for i,line in enumerate(lines):
   if any(x in line for x in keys) and ('invoke-' in line or 'iput-' in line or 'iget-' in line or 'check-cast' in line):
    matches.append((str(file.relative_to(root)), i+1, line.strip()[:210]))
 print('Scanned', folder.name)
print('=== MODEL USE SITES ===',len(matches))
for row in matches[:180]:
 print(*row,sep=' | ')
print('... TRUNCATED ...' if len(matches)>180 else 'END')
