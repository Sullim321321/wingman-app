#!/usr/bin/env node
/**
 * check-themed-hooks.js — catch the two crash classes the dark-mode sweep introduced.
 *
 * WHY THIS EXISTS
 * ---------------
 * Converting screens to themed styles (`const s = useThemedStyles(makeStyles)`) shipped
 * two latent crashes that a syntax check and check-jsx-imports both passed:
 *
 *   1. ORPHAN `s`/`C`. A sub-component (EmptyState in Trips, HeadlineText in Home) used
 *      `s.foo` but never got the `const s = useThemedStyles(...)` line. `s` was undefined,
 *      so the component threw the instant it rendered — but only in the state that renders
 *      it (empty trip list, a multi-line headline), which is why it slipped through.
 *
 *   2. HOOK IN THE WRONG PLACE. A `useThemedStyles`/`useTheme` call injected into a `.map()`
 *      callback or a conditional — not the top level of a named component — violates the
 *      rules of hooks and crashes at runtime.
 *
 * Both are invisible to a parse and to check-jsx-imports. This uses the real AST:
 *   • every `s`/`C` member reference must resolve to a binding in scope (C may fall back
 *     to the module-level `import { C }`), and
 *   • every `useTheme`/`useThemedStyles` call must be a top-level statement inside a
 *     Capitalized, named component.
 */

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const ROOT = path.resolve(__dirname, "..");

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(f)) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of walk(path.join(ROOT, "src"))) {
  const rel = path.relative(ROOT, file);
  const code = fs.readFileSync(file, "utf8");
  // Only files that actually theme need checking.
  if (!/useThemedStyles|useTheme\(/.test(code) && !/\bmakeStyles\b/.test(code)) continue;

  let ast;
  try { ast = parser.parse(code, { sourceType: "module", plugins: ["jsx"] }); }
  catch (e) { problems.push(`${rel}  parse error: ${e.message.split("\n")[0]}`); continue; }

  traverse(ast, {
    // (1) hook placement — must be top-level in a named Capitalized component
    CallExpression(p) {
      const name = p.node.callee && p.node.callee.name;
      if (name !== "useTheme" && name !== "useThemedStyles") return;
      const fnPath = p.getFunctionParent();
      let cname = null;
      const fn = fnPath && fnPath.node;
      if (fn && fn.type === "FunctionDeclaration" && fn.id) cname = fn.id.name;
      else if (fnPath && fnPath.parent && fnPath.parent.type === "VariableDeclarator" && fnPath.parent.id) cname = fnPath.parent.id.name;
      else if (fnPath && fnPath.parent && fnPath.parent.type === "ExportDefaultDeclaration") cname = "Default";
      if (!cname || !/^[A-Z]/.test(cname)) { problems.push(`${rel}:${p.node.loc.start.line}  ${name}() not inside a named component (enclosing="${cname}")`); return; }
      const stmt = p.getStatementParent();
      if (!stmt || !stmt.parentPath || stmt.parentPath.node !== fn.body) {
        problems.push(`${rel}:${p.node.loc.start.line}  ${name}() not at the top level of ${cname} (in a callback/conditional)`);
      }
    },
    // (2) orphan s/C — every member reference must be bound (C may fall back to import)
    MemberExpression(p) {
      const obj = p.node.object;
      if (!obj || obj.type !== "Identifier" || (obj.name !== "s" && obj.name !== "C")) return;
      if (p.scope.getBinding(obj.name)) return;             // bound somewhere in scope chain
      if (obj.name === "C") return;                          // module-level import { C } fallback
      problems.push(`${rel}:${obj.loc.start.line}  '${obj.name}.${p.node.property.name || "?"}' — '${obj.name}' is undefined here (missing useThemedStyles hook)`);
    },
  });
}

if (problems.length) {
  console.log(`\x1b[31m✗ themed-hook check found ${problems.length} issue(s):\x1b[0m`);
  for (const m of problems) console.log("  " + m);
  console.log("\nThese crash at render, not at parse. Fix before shipping.\n");
  process.exit(1);
}
console.log("\x1b[32m✓ themed hooks are top-level in named components; no orphan s/C\x1b[0m");
