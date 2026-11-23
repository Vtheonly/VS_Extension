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
exports.ClassicExportPipeline = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const vscode = __importStar(require("vscode"));
const PurificationService_1 = require("./PurificationService");
const SkeletonizerService_1 = require("./SkeletonizerService");
class ClassicExportPipeline {
    async execute(files, rootPath, transformOpts) {
        let exportRelPaths = files.map(f => path.relative(rootPath, f).replace(/\\/g, '/'));
        // 1. Purify export bundle if enabled
        if (transformOpts?.purify) {
            const result = PurificationService_1.PurificationService.filterFilesForExport(exportRelPaths, {
                removeMarkdown: transformOpts.removeMarkdown,
                removeLockfiles: transformOpts.removeLockfiles,
                removeDumps: true,
            });
            exportRelPaths = result.kept;
        }
        const homeDir = os.homedir();
        const projectName = path.basename(rootPath);
        const timestamp = new Date().toISOString()
            .replace(/T/, '_')
            .replace(/\..+/, '')
            .replace(/:/g, '-');
        const dstDir = path.join(homeDir, 'Downloads', `${projectName}_${timestamp}`);
        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir, { recursive: true });
        }
        const basenameMap = new Map();
        for (const rel of exportRelPaths) {
            const base = path.basename(rel);
            if (!basenameMap.has(base)) {
                basenameMap.set(base, []);
            }
            basenameMap.get(base).push(rel);
        }
        // Compute folder lines if MEDIUM mode is selected
        const folderLineCounts = new Map();
        if (transformOpts?.skeletonize && transformOpts.skeletonMode === 'medium') {
            for (const rel of exportRelPaths) {
                const folder = path.dirname(rel);
                try {
                    const src = await fs.promises.readFile(path.join(rootPath, rel), 'utf8');
                    folderLineCounts.set(folder, (folderLineCounts.get(folder) || 0) + SkeletonizerService_1.SkeletonizerService.countLines(src));
                }
                catch { }
            }
        }
        const projectStructureLines = [];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exporting files...",
            cancellable: false
        }, async () => {
            for (const [basename, relPaths] of basenameMap.entries()) {
                for (const rel of relPaths) {
                    const srcPath = path.join(rootPath, rel);
                    let content = '';
                    try {
                        content = await fs.promises.readFile(srcPath, 'utf8');
                    }
                    catch {
                        content = '// [Error reading file]';
                    }
                    // Apply Skeletonization on the exported copy
                    if (transformOpts?.skeletonize && transformOpts.skeletonMode !== 'none') {
                        const ext = path.extname(rel);
                        const folder = path.dirname(rel);
                        const shouldSkel = transformOpts.skeletonMode !== 'medium' || (folderLineCounts.get(folder) || 0) > 200;
                        if (shouldSkel) {
                            content = SkeletonizerService_1.SkeletonizerService.skeletonizeCode(content, ext, transformOpts.skeletonMode);
                        }
                    }
                    let outFilename = basename + '.txt';
                    if (relPaths.length > 1) {
                        outFilename = rel.replace(/\//g, '_') + '.txt';
                    }
                    await fs.promises.writeFile(path.join(dstDir, outFilename), content, 'utf8');
                    projectStructureLines.push(rel);
                }
            }
            await fs.promises.writeFile(path.join(dstDir, 'project_structure.txt'), projectStructureLines.join('\n'), 'utf8');
        });
        vscode.window.showInformationMessage(`Exported ${exportRelPaths.length} files -> ${dstDir}`);
        vscode.env.openExternal(vscode.Uri.file(dstDir));
    }
}
exports.ClassicExportPipeline = ClassicExportPipeline;
//# sourceMappingURL=ClassicExportPipeline.js.map