#!/usr/bin/env python3
"""Patch original Activity lifecycle methods with a non-invasive optional token panel.
The built-in Qobuz OAuth/QWS implementation remains unmodified.
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
 candidates=list(re.finditer(r'^\s*invoke-(?:super|virtual)(?:/range)?\s+\{p0(?:, p1)?\},[^\n]*\->(?:onCreate|R)\(Landroid/os/Bundle;\)V[^\n]*$',block,re.M))
 if not candidates: raise RuntimeError('Cannot find safe onCreate hook: '+name)
 line=candidates[0]
 injection='\n    invoke-static {p0}, Lcom/qobuz/mod/TokenGate;->attach(Landroid/app/Activity;)V\n'
 block=block[:line.end()]+injection+block[line.end():]
 s=s[:match.start()]+block+s[match.end():]
 path.write_text(s)
 print('PATCHED',name)
