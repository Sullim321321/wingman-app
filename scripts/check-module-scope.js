#!/usr/bin/env node
/**
 * check-module-scope.js — catch import-time crashes before they reach a build.
 *
 * WHY THIS EXISTS
 * ---------------
 * A screen once shipped with `borderColor: g(C.gold, 0.35)` inside StyleSheet.create.
 * `g` is the shared styles OBJECT, not a function. Calling it throws
 * "TypeError: Object is not a function" — at MODULE SCOPE, when the file is first
 * imported, before React mounts and before any ErrorBoundary exists.
 *
 * The result is a pure white screen with no log and no stack that names the module.
 * It cost several 20-minute TestFlight builds to find.
 *
 * A syntax check (`babel.transformSync`) would NOT have caught it: the code is
 * perfectly valid syntax. It only fails when EXECUTED. StyleSheet.create runs at
 * import time, so the bug is live the instant the module loads.
 *
 * This script actually EVALUATES each module's top-level code against a stubbed
 * React Native, so anything that throws on import fails here instead of on a phone.
 *
 *   node scripts/check-module-scope.js
 *
 * Exits non-zero if any module throws. Wire it into CI or run it before a build.
 */

const babel = require("@babel/core");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");

// A permissive stand-in for any native/third-party module. Callable, indexable,
// constructible — so `StyleSheet.create({...})`, `Animated.Value(0)`, `C.gold` and
// friends all behave, while real app code still runs for real.
function makeStub() {
  const fn = function () { return stub; };
  const stub = new Proxy(fn, {
    get(_t, k) {
      if (k === "__esModule") return true;
      if (k === "create")     return (o) => o;                        // StyleSheet.create
      if (k === "hairlineWidth") return 1;
      if (k === "get")        return () => ({ width: 390, height: 844 });
      if (k === "select")     return (o) => (o && (o.ios ?? o.default));
      if (k === "OS")         return "ios";
      if (k === "absoluteFillObject") return {};
      if (k === Symbol.toPrimitive) return () => "stub";
      return stub;
    },
    apply()     { return stub; },
    construct() { return stub; },
  });
  return stub;
}

const cache = new Map();

function loadLocal(file) {
  const abs = require.resolve(file);
  if (cache.has(abs)) return cache.get(abs);

  const src = fs.readFileSync(abs, "utf8");
  const { code } = babel.transformSync(src, {
    presets: [["babel-preset-expo", { jsxRuntime: "classic" }]],
    filename: abs,
    babelrc: false,
    configFile: false,
  });

  const exports = {};
  const module_ = { exports };
  cache.set(abs, exports);

  // Images, fonts, and other assets are handled by Metro's asset pipeline, not by
  // the JS parser. Trying to babel-parse a .webp is how you get a false positive.
  const ASSET = /\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?|mp3|wav|m4a|mp4|json)$/i;

  const localRequire = (req) => {
    // Real app code: load and execute it. Assets and node_modules: stub.
    if (ASSET.test(req)) return makeStub();
    if (req.startsWith(".") || req.startsWith("/")) {
      const resolved = Module.createRequire(abs).resolve(req);
      return loadLocal(resolved);
    }
    return makeStub();
  };

  const ctx = {
    require: localRequire,
    module: module_,
    exports,
    __filename: abs,
    __dirname: path.dirname(abs),
    console,
    process,
    global: globalThis,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set, Promise, Symbol,
    Intl,
  };

  vm.runInNewContext(code, ctx, { filename: abs });
  const result = module_.exports;
  cache.set(abs, result);
  return result;
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(f) && !p.includes("moduleProbe")) out.push(p);
  }
  return out;
}

const targets = walk(path.join(ROOT, "src"));

let failures = 0;
for (const file of targets) {
  cache.clear(); // fresh graph per entry, so one bad file can't mask another
  const rel = path.relative(ROOT, file);
  try {
    loadLocal(file);
  } catch (e) {
    failures++;
    console.log(`\x1b[31m✗\x1b[0m ${rel}`);
    console.log(`  ${e.message.split("\n")[0]}`);
  }
}

if (failures) {
  console.log(`\n\x1b[31m${failures} module(s) throw when imported.\x1b[0m`);
  console.log("These produce a WHITE SCREEN on device — no log, no stack, nothing.\n");
  process.exit(1);
}
console.log(`\x1b[32m✓ all ${targets.length} modules evaluate their top-level code cleanly\x1b[0m`);
