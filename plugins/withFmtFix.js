/**
 * Expo config plugin: withFmtFix
 *
 * Consolidates all Xcode 26 native compatibility patches into a single
 * Podfile post_install hook:
 *
 *   Patch 1 (fmt): Rewrites FMT_USE_CONSTEVAL in fmt/base.h to 0 and sets
 *     C++17 on the fmt build target. Fixes the consteval compilation error
 *     introduced by Apple Clang in Xcode 26.
 *     See: https://github.com/expo/expo/issues/44229
 *
 *   Patch 2 (RCTTurboModule): Removes @throw/@catch paths in RCTNativeModule.mm
 *     and RCTTurboModule.mm that cause SIGABRT on iOS 26 when NSExceptions
 *     propagate across dispatch queue boundaries.
 *     See: https://github.com/reactwg/react-native-new-architecture/discussions/276
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PATCH_MARKER = "WINGMAN_XCODE26_PATCHES";

const PATCH_CODE = `
  # ── WINGMAN_XCODE26_PATCHES ────────────────────────────────────────────────
  # Patch 1: fmt consteval fix (Xcode 26 / Apple Clang strict consteval)
  fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base)
    content = File.read(fmt_base)
    patched = content.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '# define FMT_USE_CONSTEVAL 0')
    if patched != content
      File.chmod(0644, fmt_base)
      File.write(fmt_base, patched)
      puts "[withFmtFix] Patched fmt/base.h: FMT_USE_CONSTEVAL -> 0"
    end
  end
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end

  # Patch 2: RCTNativeModule.mm — remove @throw in RCTFatalExceptionName check
  Dir.glob(File.join(installer.sandbox.root.to_s, '..', 'node_modules', 'react-native', '**', 'RCTNativeModule.mm')).each do |mm_path|
    content = File.read(mm_path)
    original = content.dup
    content.gsub!(
      /    \\/\\/ Pass on JS exceptions\\n    if \\(\\[exception\\.name hasPrefix:RCTFatalExceptionName\\]\\) \\{\\n      @throw exception;\\n    \\}/,
      "    // iOS 26 fix: @throw removed to prevent SIGABRT across queue boundaries"
    )
    File.write(mm_path, content) if content != original
  end

  # Patch 3: RCTTurboModule.mm — remove @catch blocks
  Dir.glob(File.join(installer.sandbox.root.to_s, '..', 'node_modules', 'react-native', '**', 'RCTTurboModule.mm')).each do |mm_path|
    content = File.read(mm_path)
    original = content.dup
    content.gsub!(/    \\} @catch \\(NSException \\*exception\\) \\{.*?\\n    \\} @finally \\{/m, "    } @finally {")
    File.write(mm_path, content) if content != original
  end
  # ── END WINGMAN_XCODE26_PATCHES ────────────────────────────────────────────`;

const withFmtFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withFmtFix] Podfile not found, skipping.");
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (podfile.includes(PATCH_MARKER)) {
        console.log("[withFmtFix] Podfile already patched, skipping.");
        return config;
      }

      // Strategy 1: insert after react_native_post_install call (most common in SDK 53)
      if (podfile.match(/react_native_post_install\s*\(/)) {
        podfile = podfile.replace(
          /(react_native_post_install\s*\([^)]*\))/,
          `$1\n${PATCH_CODE}`
        );
        console.log("[withFmtFix] Inserted patches after react_native_post_install.");
      }
      // Strategy 2: append inside existing post_install block
      else if (podfile.includes("post_install do |installer|")) {
        podfile = podfile.replace(
          /(post_install do \|installer\|)([\s\S]*?)(^end\s*$)/m,
          `$1$2${PATCH_CODE}\n$3`
        );
        console.log("[withFmtFix] Appended patches into existing post_install block.");
      }
      // Strategy 3: add a new post_install block at end of file
      else {
        podfile += `\npost_install do |installer|\n${PATCH_CODE}\nend\n`;
        console.log("[withFmtFix] Added new post_install block with patches.");
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};

module.exports = withFmtFix;
