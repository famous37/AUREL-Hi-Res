#!/usr/bin/env python3
"""Inspect original native OAuth/QWS token/session bridge in selected smali classes."""
import pathlib,sys
r=pathlib.Path(sys.argv[1])
for name in ["v2b","x2b","uuc","c3b","bgd"]:
 files=list(r.glob('smali*/'+name+'.smali'))
 print('==',name,'files',len(files))
 if not files:continue
 lines=files[0].read_text(errors='replace').splitlines()
 ranges={'v2b':[(1,150)],'x2b':[(1,150)],'uuc':[(1,130)],'c3b':[(680,805)],'bgd':[(675,760)]}[name]
 for a,b in ranges:
  for i in range(a-1,min(b,len(lines))):
   print(f'{i+1:5d} {lines[i][:240]}')
