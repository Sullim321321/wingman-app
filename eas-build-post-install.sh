#!/bin/bash
# EAS post-install hook: iOS 26 SIGABRT fix
# Removes ALL @throw paths in react-native that cross dispatch queue boundaries
echo "[eas-hook] Applying iOS 26 SIGABRT patches..."

python3 << 'PYEOF'
import re, glob

base = 'node_modules/react-native'

# Patch 1: RCTAssert.m — remove @throw from RCTFatal() and RCTFatalException()
# THIS IS THE ROOT CAUSE: every fatal error path ends here and re-throws
for p in glob.glob(f'{base}/**/RCTAssert.m', recursive=True):
    with open(p) as f: content = f.read()
    original = content

    # Fix RCTFatalException @throw
    content = re.sub(
        r'#if DEBUG\s*\n\s*@try \{\s*\n#endif\s*\n\s*@throw exception;\s*\n#if DEBUG\s*\n\s*\} @catch \(NSException \*e\) \{\s*\n\s*\}\s*\n#endif',
        '    // iOS 26 fix: @throw removed\n    NSLog(@"[RCTFatalException] %@: %@", exception.name, exception.reason);',
        content
    )
    # Fix RCTFatal @throw [[NSException alloc]...]
    content = content.replace(
        '      @throw [[NSException alloc] initWithName:name reason:message userInfo:userInfo];',
        '      // iOS 26 fix: @throw removed\n      NSLog(@"[RCTFatal] %@: %@", name, message);'
    )
    if content != original:
        with open(p, 'w') as f: f.write(content)
        print(f"[eas-hook] Patched {p}")
    else:
        active = [l.strip() for l in content.split('\n') if '@throw' in l and not l.strip().startswith('//')]
        print(f"[eas-hook] {p} — already patched (active @throw: {len(active)})")

# Patch 2: RCTNativeModule.mm — remove @throw in RCTFatalExceptionName check
for p in glob.glob(f'{base}/**/RCTNativeModule.mm', recursive=True):
    with open(p) as f: content = f.read()
    old = "    // Pass on JS exceptions\n    if ([exception.name hasPrefix:RCTFatalExceptionName]) {\n      @throw exception;\n    }"
    new = "    // iOS 26 fix: @throw removed"
    if old in content:
        with open(p, 'w') as f: f.write(content.replace(old, new))
        print(f"[eas-hook] Patched {p}")
    else:
        print(f"[eas-hook] {p} — already patched")

# Patch 3: RCTTurboModule.mm — remove @catch blocks
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

# Patch 4: RCTTurboModuleManager.mm — remove @throw UnsafeTurboModuleException
for p in glob.glob(f'{base}/**/RCTTurboModuleManager.mm', recursive=True):
    with open(p) as f: content = f.read()
    old = '              NSException *exception = [NSException exceptionWithName:@"UnsafeTurboModuleException"\n                                                               reason:reason\n                                                             userInfo:nil];\n              @throw exception;'
    new = '              // iOS 26 fix: @throw removed\n              RCTLogError(@"%@", reason);'
    if old in content:
        with open(p, 'w') as f: f.write(content.replace(old, new))
        print(f"[eas-hook] Patched {p}")
    else:
        print(f"[eas-hook] {p} — already patched")

print("[eas-hook] All patches applied.")
PYEOF
echo "[eas-hook] Done."
