#!/usr/bin/env python3
"""Read-only native-session repository mapping for Qobuz 10.2.
Output excludes token constants, URL query strings and user data.
"""
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])
for name in ('o9','u2b','w2b','k9','l9','ft0'):
 matches=list(root.glob('smali*/'+name+'.smali'))
 if not matches:continue
 lines=matches[0].read_text(errors="replace").splitlines()
 print("=== CLASS",name,'len',len(lines),'===')
 for i,l in enumerate(lines):
  if l.startswith('.field') or l.startswith('.method'):
   print(i+1,l[:180])
 if name=='o9':
  for a,b in [(3850,4100),(4550,4770)]:
   print('=== o9 slice',a,b,'===')
   for i in range(a-1,min(b,len(lines))):
    l=lines[i]
    if any(q in l for q in ('const-string','https://','Authorization','Bearer')):
     l='[STRING REDACTED]'
    print(i+1,l[:200])
