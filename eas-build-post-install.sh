#!/bin/bash
# EAS post-install hook: patch RCTNativeModule.mm and RCTTurboModule.mm (iOS 26 fix)
echo "[eas-hook] Applying iOS 26 SIGABRT patches..."

python3 << 'PYEOF'
import re, os, glob

base = 'node_modules/react-native'

# Patch 1: RCTNativeModule.mm
for p in glob.glob(f'{base}/**/RCTNativeModule.mm', recursive=True):
    with open(p) as f: content = f.read()
    old = "    // Pass on JS exceptions\n    if ([exception.name hasPrefix:RCTFatalExceptionName]) {\n      @throw exception;\n    }"
    new = "    // iOS 26 fix: @throw removed to prevent SIGABRT across queue boundaries"
    if old in content:
        with open(p, 'w') as f: f.write(content.replace(old, new))
        print(f"[eas-hook] Patched {p}")
    else:
        print(f"[eas-hook] {p} — no change needed")

# Patch 2: RCTTurboModule.mm
for p in glob.glob(f'{base}/**/RCTTurboModule.mm', recursive=True):
    with open(p) as f: content = f.read()
    new_content = re.sub(
        r'    \} @catch \(NSException \*exception\) \{.*?\n    \} @finally \{',
        '    } @finally {', content, flags=re.DOTALL)
    if new_content != content:
        with open(p, 'w') as f: f.write(new_content)
        print(f"[eas-hook] Patched {p}")
    else:
        print(f"[eas-hook] {p} — no change needed")
PYEOF
echo "[eas-hook] Done."
