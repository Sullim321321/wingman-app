/**
 * Expo config plugin: withRCTTurboModuleFix
 *
 * Patches RCTTurboModule.mm via Podfile post_install hook — runs AFTER pod install,
 * immediately before xcodebuild, guaranteeing the patch is compiled in.
 *
 * Removes ALL @catch blocks from performMethodInvocation and performVoidMethodInvocation
 * to prevent any NSException from being re-thrown on a background queue on iOS 26,
 * which causes std::terminate() → SIGABRT.
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

      // Ruby post_install: remove ALL @catch blocks from RCTTurboModule.mm
      // Uses gsub with multiline regex to match the full @catch...@finally pattern
      const rubySnippet = `
  # withRCTTurboModuleFix: Remove ALL @catch blocks from RCTTurboModule.mm (iOS 26 SIGABRT fix)
  # Ref: reactwg/react-native-new-architecture#276
  Dir.glob(File.join(installer.sandbox.root.to_s, '..', 'node_modules', 'react-native', '**', 'RCTTurboModule.mm')).each do |mm_path|
    content = File.read(mm_path)
    original = content.dup
    # Remove any @catch block that precedes @finally in these methods
    content.gsub!(/    \\} @catch \\(NSException \\*exception\\) \\{.*?\\n    \\} @finally \\{/m, "    } @finally {")
    if content != original
      File.write(mm_path, content)
      puts "[withRCTTurboModuleFix] Patched #{mm_path} — removed @catch blocks"
    else
      puts "[withRCTTurboModuleFix] #{mm_path} — no changes (already patched or pattern mismatch)"
      # Log file size for debugging
      puts "[withRCTTurboModuleFix] File size: #{content.length} bytes"
      puts "[withRCTTurboModuleFix] Has @catch: #{content.include?('@catch')}"
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
