#!/usr/bin/env python3
"""Add an optional legacy Qobuz API token panel to original Activity onCreate.
Does not modify native OAuth/QWS session credentials or sign-in restrictions.
"""
import pathlib,re,sys
root=pathlib.Path(sys.argv[1]);names=[
 'com/qobuz/android/mobile/app/screen/launch/LauncherActivity.smali',
 'com/qobuz/android/mobile/app/screen/home/MainActivity.smali',
 'com/qobuz/android/mobile/feature/onboarding/OnboardingActivity.smali']
for name in names:
 matches=list(root.glob('smali*/'+name));assert len(matches)==1,(name,matches)
 path=matches[0];s=path.read_text()
 match=re.search(r'(?ms)^\.method[^\n]*\bonCreate\(Landroid/os/Bundle;\)V\s*$.*?^\.end method$',s)
 if not match:
  print('SKIPPED NO onCreate',name)
  continue
 block=match.group()
 decl=re.search(r'(?m)^\s*\.(?:locals|registers)\s+[0-9]+\s*$',block)
 if not decl: raise RuntimeError('Cannot locate onCreate registers: '+name)
 injection='\n    invoke-static/range {p0 .. p0}, Lcom/qobuz/mod/TokenGate;->attach(Landroid/app/Activity;)V\n'
 block=block[:decl.end()]+injection+block[decl.end():]
 path.write_text(s[:match.start()]+block+s[match.end():])
 print('PATCHED',name)
