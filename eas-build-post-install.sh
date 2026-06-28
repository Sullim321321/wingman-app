#!/bin/bash
# EAS post-install hook: verify and apply RCTTurboModule.mm patch
# This runs AFTER npm ci, ensuring the patch is applied even if patch-package fails

TURBO_FILE="node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm"

echo "[eas-hook] Checking RCTTurboModule.mm patch status..."

if [ ! -f "$TURBO_FILE" ]; then
  echo "[eas-hook] ERROR: $TURBO_FILE not found!"
  exit 0
fi

if grep -q "iOS 26 fix applied\|silently drop NSException" "$TURBO_FILE"; then
  echo "[eas-hook] RCTTurboModule.mm already patched by patch-package. OK."
else
  echo "[eas-hook] patch-package did NOT apply the patch. Applying manually..."
  
  # Fix 1: Remove @throw on async path in performMethodInvocation
  if grep -q '@throw exception;' "$TURBO_FILE"; then
    # Use python for reliable multi-line replacement
    python3 << 'PYEOF'
import re

with open('node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm') as f:
    content = f.read()

# Fix 1: performMethodInvocation async @throw
old1 = '      } else {\n        @throw exception;\n      }'
new1 = '      // async: silently drop NSException (iOS 26 fix applied)'
if old1 in content:
    content = content.replace(old1, new1)
    print('[eas-hook] Fix 1 applied: async @throw removed')
else:
    print('[eas-hook] Fix 1 pattern not found')

# Fix 2: performVoidMethodInvocation @catch
old2 = '    } @catch (NSException *exception) {\n      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);\n    } @finally {'
new2 = '    } @finally {'
if old2 in content:
    content = content.replace(old2, new2)
    print('[eas-hook] Fix 2 applied: @catch block removed')
else:
    print('[eas-hook] Fix 2 pattern not found (may already be patched)')

with open('node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm', 'w') as f:
    f.write(content)
PYEOF
  else
    echo "[eas-hook] @throw exception not found - may already be patched"
  fi
fi

echo "[eas-hook] Final check:"
grep -n "iOS 26 fix applied\|silently drop\|@throw exception" "$TURBO_FILE" || echo "[eas-hook] No @throw exception found (good)"
