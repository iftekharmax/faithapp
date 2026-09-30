#!/usr/bin/env node
/**
 * Route smoke test.
 *
 * TanStack Router uses dot-separated filenames as route paths, so any file
 * that shares a prefix with sibling files becomes a *layout parent*. Layout
 * parents MUST render <Outlet /> or their child routes match but nothing
 * appears on screen (the `/students/new` regression).
 *
 * This script scans `src/routes/` and fails the build if a parent route
 * file doesn't render <Outlet />. Wire it into CI or run with
 * `node scripts/check-routes.mjs`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/routes";
const IGNORE = new Set(["README.md", "__root.tsx"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(t|j)sx?$/.test(name) && !IGNORE.has(name)) out.push(p);
  }
  return out;
}

// route key = filename without extension, e.g. "_authenticated.students"
const files = walk(ROOT).map((path) => ({
  path,
  key: path.slice(ROOT.length + 1).replace(/\.(t|j)sx?$/, ""),
}));

const keys = new Set(files.map((f) => f.key));
const problems = [];

for (const f of files) {
  // Skip explicit index files — they're always leaves.
  if (f.key.endsWith(".index") || f.key === "index") continue;

  // A file is a parent if any other route key starts with "<key>." — that
  // sibling is a child route nested underneath it.
  const isParent = [...keys].some((k) => k !== f.key && k.startsWith(f.key + "."));
  if (!isParent) continue;

  const src = readFileSync(f.path, "utf8");
  const rendersOutlet = /<Outlet\b/.test(src);
  if (!rendersOutlet) {
    problems.push(
      `  • ${f.path}\n    Acts as a layout parent for child routes but never renders <Outlet />.\n    Fix: either render <Outlet /> in its component, or rename it to\n    "${f.key}.index.tsx" so it becomes a leaf and the child routes render.`,
    );
  }
}

if (problems.length) {
  console.error(
    `\n✖ Route smoke test failed — ${problems.length} layout parent(s) missing <Outlet />:\n\n${problems.join("\n\n")}\n`,
  );
  process.exit(1);
}

console.log(`✓ Route smoke test passed (${files.length} route files scanned).`);
