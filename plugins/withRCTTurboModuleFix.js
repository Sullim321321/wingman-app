/**
 * Expo config plugin: withRCTTurboModuleFix
 *
 * Patches RCTNativeModule.mm and RCTTurboModule.mm via Podfile post_install hook.
 * Removes all @throw / C++ throw paths that cause SIGABRT on iOS 26 when
 * NSExceptions propagate across dispatch queue boundaries.
 *
 * Ref: https://github.com/reactwg/react-native-new-architecture/discussions/276
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withRCTTurboModuleFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withRCTTurboModuleFix] Podfile not found, skipping.");
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (podfile.includes("withRCTTurboModuleFix")) {
        console.log("[withRCTTurboModuleFix] Podfile already patched.");
        return config;
      }

      const rubySnippet = `
  # withRCTTurboModuleFix: iOS 26 SIGABRT fix
  # Removes @throw paths in RCTNativeModule.mm and RCTTurboModule.mm
  # that cause std::terminate() when NSExceptions cross dispatch queue boundaries.
  # Ref: reactwg/react-native-new-architecture#276

  # Patch 1: RCTNativeModule.mm — remove @throw in RCTFatalExceptionName check
  Dir.glob(File.join(installer.sandbox.root.to_s, '..', 'node_modules', 'react-native', '**', 'RCTNativeModule.mm')).each do |mm_path|
    content = File.read(mm_path)
    original = content.dup
    content.gsub!(
      /    \/\/ Pass on JS exceptions\\n    if \\(\\[exception\\.name hasPrefix:RCTFatalExceptionName\\]\\) \\{\\n      @throw exception;\\n    \\}/,
      "    // iOS 26 fix: @throw removed to prevent SIGABRT across queue boundaries"
    )
    if content != original
      File.write(mm_path, content)
      puts "[withRCTTurboModuleFix] Patched RCTNativeModule.mm"
    else
      puts "[withRCTTurboModuleFix] RCTNativeModule.mm — no change (has @throw: #{content.include?('@throw exception')})"
    end
  end

  # Patch 2: RCTTurboModule.mm — remove all @catch blocks
  Dir.glob(File.join(installer.sandbox.root.to_s, '..', 'node_modules', 'react-native', '**', 'RCTTurboModule.mm')).each do |mm_path|
    content = File.read(mm_path)
    original = content.dup
    content.gsub!(/    \\} @catch \\(NSException \\*exception\\) \\{.*?\\n    \\} @finally \\{/m, "    } @finally {")
    if content != original
      File.write(mm_path, content)
      puts "[withRCTTurboModuleFix] Patched RCTTurboModule.mm"
    else
      puts "[withRCTTurboModuleFix] RCTTurboModule.mm — no change (has @catch: #{content.include?('@catch')})"
    end
  end`;

      if (podfile.includes("post_install do |installer|")) {
        podfile = podfile.replace(
          /(\s*react_native_post_install\(installer[^)]*\))/,
          `$1\n${rubySnippet}`
        );
      } else {
        podfile += `\npost_install do |installer|\n${rubySnippet}\nend\n`;
      }

      fs.writeFileSync(podfilePath, podfile);
      console.log("[withRCTTurboModuleFix] Injected Podfile post_install patch.");
      return config;
    },
  ]);
};

module.exports = withRCTTurboModuleFix;
