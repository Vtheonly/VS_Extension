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
exports.SkeletonizerService = void 0;
const path = __importStar(require("path"));
const TYPE_NAMES = {
    ".ts": "TypeScript (.ts)",
    ".tsx": "TypeScript React (.tsx)",
    ".js": "JavaScript (.js)",
    ".jsx": "JavaScript React (.jsx)",
    ".py": "Python (.py)",
    ".kt": "Kotlin (.kt)",
    ".java": "Java (.java)",
    ".rs": "Rust (.rs)",
    ".go": "Go (.go)",
    ".c": "C (.c)",
    ".cpp": "C++ (.cpp)",
    ".h": "C/C++ Header (.h)",
    ".hpp": "C++ Header (.hpp)",
    ".sql": "SQL Schema / Procs (.sql)",
    ".json": "JSON Manifest (.json)",
    ".md": "Markdown (.md)",
};
class SkeletonizerService {
    static countLines(text) {
        if (!text)
            return 0;
        return text.split(/\r?\n/).length;
    }
    /**
     * Transforms raw code string according to SkeletonMode. Pure in-memory transformation.
     */
    static skeletonizeCode(content, ext, mode) {
        if (mode === "none")
            return content;
        ext = ext.toLowerCase();
        if (ext === ".sql") {
            return SkeletonizerService.skeletonizeSql(content, mode);
        }
        else if (ext === ".py") {
            return SkeletonizerService.skeletonizePython(content, mode);
        }
        else if ([
            ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
            ".kt", ".java", ".rs", ".go", ".c", ".cpp", ".h", ".hpp",
        ].includes(ext)) {
            return SkeletonizerService.skeletonizeCStyle(content, mode);
        }
        return content;
    }
    static skeletonizePython(content, mode) {
        const lines = content.split(/\r?\n/);
        const out = [];
        let i = 0;
        const n = lines.length;
        const defRe = /^\s*(async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/;
        while (i < n) {
            const line = lines[i];
            const match = defRe.exec(line);
            if (match) {
                const indentMatch = line.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : "";
                const bodyIndent = indent + "    ";
                let end = i + 1;
                while (end < n) {
                    const nextLine = lines[end];
                    if (nextLine.trim() === "") {
                        end++;
                        continue;
                    }
                    const nextIndentMatch = nextLine.match(/^(\s*)/);
                    const nextIndent = nextIndentMatch ? nextIndentMatch[1] : "";
                    if (nextIndent.length <= indent.length)
                        break;
                    end++;
                }
                const span = end - i;
                if (mode === "light" && span <= 25) {
                    out.push(...lines.slice(i, end));
                    i = end;
                    continue;
                }
                out.push(line);
                let d = i + 1;
                if (d < end && lines[d].trim().startsWith('"""')) {
                    out.push(lines[d]);
                    if (!lines[d].trim().endsWith('"""') || lines[d].trim() === '"""') {
                        d++;
                        while (d < end) {
                            out.push(lines[d]);
                            if (lines[d].includes('"""'))
                                break;
                            d++;
                        }
                    }
                }
                out.push(`${bodyIndent}...`);
                i = end;
                continue;
            }
            out.push(line);
            i++;
        }
        return out.join("\n");
    }
    static skeletonizeSql(content, mode) {
        const lines = content.split(/\r?\n/);
        const out = [];
        let i = 0;
        const n = lines.length;
        const funcDeclRe = /^\s*CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE)\s+([a-zA-Z0-9_.\"]+)/i;
        const insertRe = /^\s*INSERT\s+INTO\s+[a-zA-Z0-9_.\"]+/i;
        while (i < n) {
            const line = lines[i];
            const stripped = line.trim();
            if (funcDeclRe.test(stripped)) {
                const start = i;
                let end = i;
                let inDollar = false;
                while (end < n) {
                    const cur = lines[end];
                    if (cur.includes("$$")) {
                        if (!inDollar) {
                            inDollar = true;
                        }
                        else if (cur.trim().endsWith("$$;") || cur.includes("LANGUAGE")) {
                            break;
                        }
                    }
                    end++;
                }
                if (end >= n)
                    end = n - 1;
                const funcLines = lines.slice(start, end + 1);
                const span = funcLines.length;
                if (mode === "light" && span <= 25) {
                    out.push(...funcLines);
                    i = end + 1;
                    continue;
                }
                const header = [];
                const declare = [];
                let inDecl = false;
                let inBody = false;
                for (const fl of funcLines) {
                    const st = fl.trim();
                    if (!inBody && !inDecl) {
                        header.push(fl);
                        if (st.includes("$$")) {
                            if (/DECLARE/i.test(st))
                                inDecl = true;
                            else if (/BEGIN/i.test(st))
                                inBody = true;
                        }
                    }
                    else if (inDecl) {
                        if (/^\s*BEGIN\b/i.test(st)) {
                            inDecl = false;
                            inBody = true;
                        }
                        else {
                            declare.push(fl);
                        }
                    }
                }
                out.push(...header);
                if (declare.length > 0)
                    out.push(...declare);
                out.push("BEGIN");
                out.push(`    -- [Procedural logic omitted: ${span} lines of business rules]`);
                if (/RETURNS\s+TABLE/i.test(content)) {
                    out.push("    RETURN QUERY ...;");
                }
                else if (/RETURNS\s+TRIGGER/i.test(content)) {
                    out.push("    RETURN NEW;");
                }
                else {
                    out.push("    RETURN;");
                }
                out.push("END;");
                out.push(funcLines[funcLines.length - 1].includes("$$")
                    ? funcLines[funcLines.length - 1]
                    : "$$ LANGUAGE plpgsql;");
                i = end + 1;
                continue;
            }
            if (insertRe.test(stripped) && (stripped.toUpperCase().includes("VALUES") || (i + 1 < n && lines[i + 1].toUpperCase().includes("VALUES")))) {
                let insertEnd = i;
                while (insertEnd < n && !lines[insertEnd].trim().endsWith(";")) {
                    insertEnd++;
                }
                const span = insertEnd - i + 1;
                if (span > 10 && (mode !== "light" || span > 25)) {
                    out.push(...lines.slice(i, Math.min(i + 4, insertEnd)));
                    out.push(`    -- ... [${span - 4} seed data rows omitted for brevity] ...;`);
                    i = insertEnd + 1;
                    continue;
                }
            }
            out.push(line);
            i++;
        }
        return out.join("\n");
    }
    static skeletonizeCStyle(content, mode) {
        const lines = content.split(/\r?\n/);
        const out = [];
        let i = 0;
        const n = lines.length;
        const funcDeclRe = /^(export\s+)?(default\s+)?(async\s+)?(function\b|class\b|interface\b|type\b|enum\b|public\b|private\b|protected\b|static\b|override\b|abstract\b|const\b|let\b|var\b|fun\b|def\b|[a-zA-Z0-9_$]+\s*\()/;
        const controlRe = /^\s*(if|for|while|switch|catch|else|do|finally)\b/;
        while (i < n) {
            const line = lines[i];
            const stripped = line.trim();
            if (stripped.startsWith("//") ||
                stripped.startsWith("/*") ||
                stripped.startsWith("*") ||
                !stripped ||
                stripped.startsWith("import ") ||
                stripped.startsWith("export *")) {
                out.push(line);
                i++;
                continue;
            }
            if (/^\s*(interface|type|enum)\b/.test(stripped)) {
                out.push(line);
                i++;
                continue;
            }
            if (funcDeclRe.test(stripped) && !controlRe.test(stripped) && line.includes("{")) {
                const start = i;
                let depth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                let end = i + 1;
                while (end < n && depth > 0) {
                    depth += (lines[end].match(/{/g) || []).length - (lines[end].match(/}/g) || []).length;
                    end++;
                }
                const span = end - start;
                if (mode === "light" && span <= 25) {
                    out.push(...lines.slice(start, end));
                    i = end;
                    continue;
                }
                const prefix = line.substring(0, line.indexOf("{")).trimEnd();
                out.push(`${prefix} { /* ... [Implementation omitted] ... */ }`);
                i = end;
                continue;
            }
            out.push(line);
            i++;
        }
        return out.join("\n");
    }
    static generateReport(mode, metrics, removedCount, removedLines, mdRemovedCount) {
        let totalBefore = removedLines;
        let totalAfter = 0;
        let skeletonized = 0;
        let unchanged = 0;
        const typeStats = {};
        for (const m of metrics) {
            totalBefore += m.linesBefore;
            totalAfter += m.linesAfter;
            if (m.modified)
                skeletonized++;
            else
                unchanged++;
            const ext = path.extname(m.relPath).toLowerCase();
            const pretty = TYPE_NAMES[ext] || `Other (${ext})`;
            if (!typeStats[pretty]) {
                typeStats[pretty] = { files: 0, before: 0, after: 0 };
            }
            typeStats[pretty].files++;
            typeStats[pretty].before += m.linesBefore;
            typeStats[pretty].after += m.linesAfter;
        }
        const linesRemoved = totalBefore - totalAfter;
        const reduction = totalBefore > 0 ? (linesRemoved / totalBefore) * 100 : 0;
        return {
            mode,
            totalLinesBefore: totalBefore,
            totalLinesAfter: totalAfter,
            linesRemoved,
            reductionPercentage: Number(reduction.toFixed(2)),
            filesScanned: metrics.length + removedCount,
            filesSkeletonized: skeletonized,
            filesUnchanged: unchanged,
            filesRemoved: removedCount,
            markdownRemoved: mdRemovedCount,
            typeStats,
        };
    }
}
exports.SkeletonizerService = SkeletonizerService;
//# sourceMappingURL=SkeletonizerService.js.map