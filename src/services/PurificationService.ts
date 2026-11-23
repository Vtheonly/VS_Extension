import * as path from "path";

const BUILD_DIR_PATTERNS = [
  /^(dist.*|release.*|build.*|out.*|target|\.output|\.next|\.nuxt|\.svelte-kit)$/i,
  /^(\.turbo|\.parcel-cache|\.vite|\.cache|\.temp|\.tmp|tmp|temp)$/i,
  /^(coverage|\.nyc_output|playwright-report|test-results|blob-report)$/i,
  /^(__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.tox|\.nox|\.venv|venv|env)$/i,
  /^(node_modules|\.gradle|\.cxx|CMakeFiles|obj|bin|\.eggs|.*\.egg-info)$/i,
  /^(\.idea|\.vscode-test|\.Spotlight-V100|\.Trashes)$/i,
];

const COMPILED_EXTS = new Set([
  ".pyc", ".pyo", ".pyd", ".class", ".tsbuildinfo", ".eslintcache",
  ".o", ".obj", ".a", ".so", ".dylib", ".dll", ".exe", ".map", ".db-journal"
]);

const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "Cargo.lock", "poetry.lock", "Pipfile.lock"
]);

const CANONICAL_SPECS = new Set(["prices.md", "canonical-financial-logic.md"]);

export class PurificationService {
  /**
   * Filters a list of relative workspace files, removing artifacts for the export.
   */
  public static filterFilesForExport(
    relPaths: string[],
    opts: {
      removeMarkdown?: boolean;
      removeLockfiles?: boolean;
      removeDumps?: boolean;
    } = {}
  ): { kept: string[]; removed: string[] } {
    const removeMarkdown = opts.removeMarkdown !== false;
    const removeLockfiles = opts.removeLockfiles !== false;
    const removeDumps = opts.removeDumps !== false;

    // Collect TS stems for derived JS check
    const tsStems = new Set<string>();
    for (const rel of relPaths) {
      const ext = path.extname(rel);
      if ([".ts", ".tsx"].includes(ext) && !rel.endsWith(".d.ts")) {
        tsStems.add(rel.replace(/\.[^/.]+$/, ""));
      }
    }

    const kept: string[] = [];
    const removed: string[] = [];

    for (const rel of relPaths) {
      const parts = rel.split("/");
      const filename = parts[parts.length - 1];
      const ext = path.extname(filename).toLowerCase();

      // Check build dirs
      const inBuildDir = parts.slice(0, -1).some(d => BUILD_DIR_PATTERNS.some(re => re.test(d)));
      if (inBuildDir) {
        removed.push(rel);
        continue;
      }

      // Compiled bytecode
      if (COMPILED_EXTS.has(ext)) {
        removed.push(rel);
        continue;
      }

      // Lockfiles
      if (removeLockfiles && LOCKFILES.has(filename)) {
        removed.push(rel);
        continue;
      }

      // Markdown documentation
      if (removeMarkdown && ext === ".md" && !CANONICAL_SPECS.has(filename.toLowerCase())) {
        removed.push(rel);
        continue;
      }

      // Derived JS matching TS companion
      if ([".js", ".cjs", ".mjs"].includes(ext)) {
        const stem = rel.replace(/\.[^/.]+$/, "");
        if (tsStems.has(stem)) {
          removed.push(rel);
          continue;
        }
      }

      // Synthetic dumps & fixtures
      if (removeDumps) {
        if (
          filename.startsWith("test-fixture-") ||
          filename.startsWith("_entire_project_") ||
          filename.startsWith("project_dump") ||
          filename.endsWith("_export_.txt") ||
          [".tar.gz", ".zip", ".dump", ".tar"].some(e => rel.endsWith(e))
        ) {
          removed.push(rel);
          continue;
        }
      }

      kept.push(rel);
    }

    return { kept, removed };
  }
}