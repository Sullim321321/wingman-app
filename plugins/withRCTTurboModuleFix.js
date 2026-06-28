/**
 * Expo config plugin: withRCTTurboModuleFix
 *
 * Patches RCTTurboModule.mm to remove the iOS 26 SIGABRT crash paths.
 * Uses withDangerousMod to modify the file directly in node_modules
 * during expo prebuild (before pod install and Xcode compilation).
 *
 * Ref: https://github.com/reactwg/react-native-new-architecture/discussions/276
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native",
  "ReactCommon",
  "react",
  "nativemodule",
  "core",
  "platform",
  "ios",
  "ReactCommon",
  "RCTTurboModule.mm"
);

const withRCTTurboModuleFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      if (!fs.existsSync(TARGET_FILE)) {
        console.warn("[withRCTTurboModuleFix] RCTTurboModule.mm not found, skipping.");
        return config;
      }

      let content = fs.readFileSync(TARGET_FILE, "utf8");

      if (content.includes("// iOS 26 fix applied")) {
        console.log("[withRCTTurboModuleFix] Already patched, skipping.");
        return config;
      }

      let patched = false;

      // Fix 1: performMethodInvocation — remove @throw on async path
      const old1 = `      } else {
        @throw exception;
      }`;
      const new1 = `      // async: silently drop NSException (iOS 26 fix applied)`;
      if (content.includes(old1)) {
        content = content.replace(old1, new1);
        patched = true;
        console.log("[withRCTTurboModuleFix] Fix 1 applied: performMethodInvocation async @throw removed.");
      } else {
        console.warn("[withRCTTurboModuleFix] Fix 1 pattern not found.");
      }

      // Fix 2: performVoidMethodInvocation — remove @catch block entirely
      const old2 = `    } @catch (NSException *exception) {
      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
    } @finally {`;
      const new2 = `    } @finally {`;
      if (content.includes(old2)) {
        content = content.replace(old2, new2);
        patched = true;
        console.log("[withRCTTurboModuleFix] Fix 2 applied: performVoidMethodInvocation @catch removed.");
      } else {
        console.warn("[withRCTTurboModuleFix] Fix 2 pattern not found (may already be patched by patch-package).");
      }

      if (patched) {
        fs.writeFileSync(TARGET_FILE, content);
        console.log("[withRCTTurboModuleFix] RCTTurboModule.mm patched successfully.");
      }

      return config;
    },
  ]);
};

module.exports = withRCTTurboModuleFix;
