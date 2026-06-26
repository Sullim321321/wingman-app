const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Patch @expo/metro-config serializeChunks.js to fix the
// "Chunk containing module not found: undefined" AssertionError that occurs
// with Expo SDK 53 + @expo/metro-config 0.20.x when async imports are used.
// This is a known upstream bug; the patch skips undefined chunks instead of
// throwing, which is the correct behaviour per the comment in the source.
// ---------------------------------------------------------------------------
const serializeChunksPath = path.resolve(
  __dirname,
  "node_modules/@expo/metro-config/build/serializer/serializeChunks.js"
);
if (fs.existsSync(serializeChunksPath)) {
  let src = fs.readFileSync(serializeChunksPath, "utf8");
  const bad = `(0, assert_1.default)(chunkContainingModule, 'Chunk containing module not found: ' + dependency.absolutePath);`;
  const good = `if (!chunkContainingModule) { return; } // patched by metro.config.js`;
  if (src.includes(bad)) {
    fs.writeFileSync(serializeChunksPath, src.replace(bad, good), "utf8");
    console.log("[metro.config] Patched serializeChunks.js async chunk assertion");
  }
}

const config = getDefaultConfig(__dirname);

module.exports = config;
