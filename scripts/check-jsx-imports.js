#!/usr/bin/env node
/**
 * check-jsx-imports.js — catch <Component> used but never imported or defined.
 *
 * WHY THIS EXISTS
 * ---------------
 * HomeScreen rendered <Leg> and <RideCount> but the import line was never added —
 * an edit script guessed the wrong theme-import line to anchor to, and missed
 * silently. `Leg` was undefined at render, so Hermes threw
 * "Property 'Leg' doesn't exist" the instant Home tried to draw. The app crashed
 * on open for every user.
 *
 * check-module-scope.js did NOT catch it: the file's top-level code evaluates fine.
 * The reference only fails when the component RENDERS. A syntax check passes too —
 * it's valid syntax. It only breaks when executed inside a render.
 *
 * The same audit also surfaced two older crashes hiding in the codebase:
 * FlightSearch used <DateTimePicker> imported nowhere, GroundTransport used
 * <SafeAreaView> with only useSafeAreaInsets imported.
 *
 * So: for every JSX element with a Capitalized name, confirm the name is imported,
 * required, or defined locally. This is a heuristic (regex, not a full parser), but
 * it catches the exact class that shipped. False positives are possible in comments
 * and strings; the ALLOW list below absorbs the known ones.
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

// Names that look like components in text but aren't real JSX usages — comments,
// doc strings, regex title-junk. Add here rather than weakening the check.
const ALLOW = new Set(["Something", "React"]);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(f)) out.push(p);
  }
  return out;
}

let failures = 0;
for (const file of walk(path.join(ROOT, "src"))) {
  const s = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  // Every <Capitalized ...> opening tag. Dotted names (<Foo.Bar>) are handled by
  // checking the root before the dot.
  const used = new Set(
    [...s.matchAll(/<([A-Z][A-Za-z0-9]*)(?:\.[A-Za-z0-9]+)?[\s/>]/g)].map((m) => m[1]),
  );

  for (const name of used) {
    if (ALLOW.has(name)) continue;
    // Imported, required, or defined locally (function / const / class / assignment).
    // NOTE: import match uses [^;] (not [^;\n]) so it spans multi-line
    // `import {\n  A, B,\n} from "..."` blocks — the RN convention here. Excluding
    // newlines is what produced 262 false positives on the first cut.
    const found = new RegExp(
      "(import[^;]*\\b" + name + "\\b" +             // import { Name } / import Name (multiline)
      "|\\b(?:function|const|let|class)\\s+" + name + "\\b" +  // local definition
      "|\\b" + name + "\\s*=)",                       // const Name = / Name =
    ).test(s);
    if (!found) {
      failures++;
      console.log(`\x1b[31m✗\x1b[0m ${rel}  <${name}> used but not imported or defined`);
    }
  }
}

if (failures) {
  console.log(`\n\x1b[31m${failures} component(s) referenced without an import.\x1b[0m`);
  console.log("These throw \"Property 'X' doesn't exist\" the moment they render.\n");
  process.exit(1);
}
console.log("\x1b[32m✓ every JSX component is imported or defined\x1b[0m");
