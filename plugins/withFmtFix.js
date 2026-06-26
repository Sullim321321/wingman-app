/**
 * Expo config plugin: withFmtFix
 *
 * Patches the generated ios/Podfile to compile the `fmt` pod with C++17
 * instead of C++20. This works around the fmt::basic_format_string consteval
 * error introduced in Xcode 26 / Clang's stricter constant-expression rules.
 *
 * See: https://github.com/expo/expo/issues/44229
 *      https://github.com/facebook/react-native/issues/55601
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withFmtFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withFmtFix] Podfile not found, skipping patch.");
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");

      const patch = `
  # Fix: fmt consteval error on Xcode 26 (Clang C++20 strict consteval enforcement)
  # Compiles only the fmt pod with C++17 so the problematic code path is skipped.
  # See: https://github.com/expo/expo/issues/44229
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end`;

      // Only patch once
      if (podfile.includes("fmt consteval error on Xcode 26")) {
        console.log("[withFmtFix] Podfile already patched, skipping.");
        return config;
      }

      // Insert before the last `end` of the post_install block
      if (podfile.includes("post_install do |installer|")) {
        // Append patch just before the closing `end` of post_install
        podfile = podfile.replace(
          /(\s*react_native_post_install\(installer[^)]*\))/,
          `$1\n${patch}`
        );
        console.log("[withFmtFix] Patched Podfile with fmt C++17 fix.");
      } else {
        // No post_install block yet — add one
        podfile += `\npost_install do |installer|\n${patch}\nend\n`;
        console.log("[withFmtFix] Added post_install block with fmt C++17 fix.");
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};

module.exports = withFmtFix;
