#!/bin/bash
# EAS post-install hook: patch RCTNativeModule.mm, RCTTurboModule.mm, RCTTurboModuleManager.mm
# iOS 26 SIGABRT fix — removes all @throw paths that cross dispatch queue boundaries
echo "[eas-hook] Applying iOS 26 SIGABRT patches..."

python3 << 'PYEOF'
import re, glob

base = 'node_modules/react-native'

# Patch 1: RCTNativeModule.mm — remove @throw in RCTFatalExceptionName check
for p in glob.glob(f'{base}/**/RCTNativeModule.mm', recursive=True):
    with open(p) as f: content = f.read()
    old = "    // Pass on JS exceptions\n    if ([exception.name hasPrefix:RCTFatalExceptionName]) {\n      @throw exception;\n    }"
    new = "    // iOS 26 fix: @throw removed to prevent SIGABRT across queue boundaries"
    if old in content:
        with open(p, 'w') as f: f.write(content.replace(old, new))
        print(f"[eas-hook] Patched {p}")
    else:
        has_throw = '@throw exception' in content and '//' not in content[content.find('@throw exception')-5:content.find('@throw exception')]
        print(f"[eas-hook] {p} — already patched (has active @throw: {has_throw})")

# Patch 2: RCTTurboModule.mm — remove all @catch blocks
for p in glob.glob(f'{base}/**/RCTTurboModule.mm', recursive=True):
    with open(p) as f: content = f.read()
    new_content = re.sub(
        r'    \} @catch \(NSException \*exception\) \{.*?\n    \} @finally \{',
        '    } @finally {', content, flags=re.DOTALL)
    if new_content != content:
        with open(p, 'w') as f: f.write(new_content)
        print(f"[eas-hook] Patched {p}")
    else:
        print(f"[eas-hook] {p} — already patched")

# Patch 3: RCTTurboModuleManager.mm — remove @throw UnsafeTurboModuleException
for p in glob.glob(f'{base}/**/RCTTurboModuleManager.mm', recursive=True):
    with open(p) as f: content = f.read()
    old = '              NSException *exception = [NSException exceptionWithName:@"UnsafeTurboModuleException"\n                                                               reason:reason\n                                                             userInfo:nil];\n              @throw exception;'
    new = '              // iOS 26 fix: @throw removed — propagating NSException across dispatch queue\n              // boundaries causes std::terminate() → SIGABRT. Log instead.\n              RCTLogError(@"%@", reason);'
    if old in content:
        with open(p, 'w') as f: f.write(content.replace(old, new))
        print(f"[eas-hook] Patched {p}")
    else:
        has_throw = '@throw exception' in content
        print(f"[eas-hook] {p} — already patched (has @throw: {has_throw})")
PYEOF
echo "[eas-hook] Done."
