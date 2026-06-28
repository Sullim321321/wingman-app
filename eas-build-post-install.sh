#!/bin/bash
# EAS post-install hook: verify and apply RCTTurboModule.mm patch
TURBO_FILE="node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm"
echo "[eas-hook] Checking RCTTurboModule.mm..."
if [ ! -f "$TURBO_FILE" ]; then
  echo "[eas-hook] File not found: $TURBO_FILE"
  exit 0
fi
echo "[eas-hook] @catch count before: $(grep -c '@catch' "$TURBO_FILE" || echo 0)"
python3 - << 'PYEOF'
import re
with open('node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm') as f:
    content = f.read()
new_content = re.sub(
    r'    \} @catch \(NSException \*exception\) \{.*?\n    \} @finally \{',
    '    } @finally {',
    content,
    flags=re.DOTALL
)
if new_content != content:
    with open('node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm', 'w') as f:
        f.write(new_content)
    print("[eas-hook] Patch applied successfully")
else:
    print("[eas-hook] No changes needed (already patched)")
PYEOF
echo "[eas-hook] @catch count after: $(grep -c '@catch' "$TURBO_FILE" || echo 0)"
