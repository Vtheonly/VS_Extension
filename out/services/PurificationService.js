"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurificationService = void 0;
const path = __importStar(require("path"));
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
class PurificationService {
    /**
     * Filters a list of relative workspace files, removing artifacts for the export.
     */
    static filterFilesForExport(relPaths, opts = {}) {
        const removeMarkdown = opts.removeMarkdown !== false;
        const removeLockfiles = opts.removeLockfiles !== false;
        const removeDumps = opts.removeDumps !== false;
        // Collect TS stems for derived JS check
        const tsStems = new Set();
        for (const rel of relPaths) {
            const ext = path.extname(rel);
            if ([".ts", ".tsx"].includes(ext) && !rel.endsWith(".d.ts")) {
                tsStems.add(rel.replace(/\.[^/.]+$/, ""));
            }
        }
        const kept = [];
        const removed = [];
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
                if (filename.startsWith("test-fixture-") ||
                    filename.startsWith("_entire_project_") ||
                    filename.startsWith("project_dump") ||
                    filename.endsWith("_export_.txt") ||
                    [".tar.gz", ".zip", ".dump", ".tar"].some(e => rel.endsWith(e))) {
                    removed.push(rel);
                    continue;
                }
            }
            kept.push(rel);
        }
        return { kept, removed };
    }
}
exports.PurificationService = PurificationService;
//# sourceMappingURL=PurificationService.js.map