#!/usr/bin/env python3
"""Locate original native OAuth login persistence and navigation sites, no secrets."""
import pathlib,sys,re
root=pathlib.Path(sys.argv[1]); needles=['Lw2b;','Lu2b;','Lx2b;','Ltuc;','Lvhg;']
hits=[]
for folder in root.glob('smali*'):
 for f in folder.rglob('*.smali'):
  if f.name in ('w2b.smali','u2b.smali','x2b.smali','tuc.smali','vhg.smali'):continue
  try:
   txt=f.read_text(errors='replace')
  except Exception:continue
  matched=[q for q in needles if q in txt]
  if not matched:continue
  ls=txt.splitlines()
  for i,line in enumerate(ls):
   if any(q in line for q in needles) and ('invoke-' in line or 'iput-' in line or 'iget-' in line or 'check-cast' in line):
    hits.append((str(f.relative_to(root)),i+1,line.strip()))
print("Native model refs",len(hits))
for p,i,line in hits[:250]:
 print(p,i,line[:200],sep=' | ')
for name in ['w2b','u2b','tuc','vhg']:
 fs=list(root.glob('smali*/'+name+'.smali'))
 print('=====CLASS',name,'=====',len(fs))
 if not fs:continue
 lines=fs[0].read_text(errors='replace').splitlines()
 for idx,line in enumerate(lines):
  if line.startswith('.field') or line.startswith('.method'):
   print(idx+1,line[:180])
