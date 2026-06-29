/**
 * withRCTTurboModuleFix — no-op passthrough
 *
 * The RCTTurboModule Xcode 26 patches have been consolidated into
 * withFmtFix.js to avoid double-insertion into the Podfile post_install block.
 * This file is kept as a passthrough so existing app.json plugin references
 * continue to resolve without error.
 */
const withRCTTurboModuleFix = (config) => config;
module.exports = withRCTTurboModuleFix;
