#!/usr/bin/env python3
"""Read-only structural verification of supplied Qobuz 10.2.0.0 APK."""
import hashlib
import json
import re
import struct
import sys
import zipfile

EXPECTED_SHA = "1edc1577006a7fe07f17ee4fdeac2a6bc2109688cae61aa0448813a0b57c0529"
EXPECTED_SIZE = 40106588
INTERESTING = ("OAuthLoginDto", "OAuthDto", "QWSAuthDto", "QWSAuthTokenDto")

def uleb(b, p):
    n=0
    for i in range(5):
        c=b[p]
        p+=1
        n|=(c & 127) << (i*7)
        if c < 128: return n,p
    raise ValueError("invalid LEB128")

def dex_strings(b):
    if not b.startswith(b"dex\n"): raise ValueError("invalid DEX magic")
    count, start = struct.unpack_from("<II",b,56)
    values=[]
    for i in range(count):
        off, = struct.unpack_from("<I",b,start+i*4)
        _,off=uleb(b,off)
        end=b.find(b"\0",off)
        if end<0: raise ValueError("unterminated DEX string")
        values.append(b[off:end].decode("utf-8","replace"))
    return values

def inspect(path):
    data=open(path,"rb").read()
    h=hashlib.sha256(data).hexdigest()
    if len(data) != EXPECTED_SIZE or h != EXPECTED_SHA:
        raise ValueError("SOURCE MISMATCH: expected original Qobuz 10.2.0.0; got sha256="+h)
    result={"sha256":h, "size":len(data), "dex":{}, "found_models":[]}
    with zipfile.ZipFile(path) as z:
        names=[n for n in z.namelist() if re.fullmatch(r"classes(?:[2-9][0-9]*)?\.dex",n)]
        if len(names)!=4: raise ValueError("unexpected DEX count "+str(len(names)))
        found=set()
        for name in sorted(names):
            vals=dex_strings(z.read(name))
            matches=[x for x in vals if any(n in x for n in INTERESTING) and x.startswith("Lcom/qobuz/")]
            result["dex"][name]={"string_count":len(vals), "auth_models":matches[:50]}
            found.update(n for n in INTERESTING if any(n in v for v in matches))
        result["found_models"]=sorted(found)
    if set(INTERESTING)-found:
        raise ValueError("missing expected auth models: "+str(set(INTERESTING)-found))
    return result

if __name__=="__main__":
    if len(sys.argv)!=2: sys.exit("usage: verify_qobuz_apk.py <original.apk>")
    print(json.dumps(inspect(sys.argv[1]),indent=2))
