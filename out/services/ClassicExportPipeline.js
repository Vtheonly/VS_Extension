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
class ClassicExportPipeline {
    async execute(files, rootPath) {
        const basenameMap = new Map();
        for (const filePath of files) {
            const base = path.basename(filePath);
            if (!basenameMap.has(base)) {
                basenameMap.set(base, []);
            }
            basenameMap.get(base).push(filePath);
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
        const projectStructureLines = [];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exporting files...",
            cancellable: false
        }, async () => {
            for (const [basename, paths] of basenameMap.entries()) {
                if (paths.length === 1) {
                    const srcPath = paths[0];
                    await fs.promises.copyFile(srcPath, path.join(dstDir, basename + '.txt'));
                    projectStructureLines.push(path.relative(rootPath, srcPath).split(path.sep).join('/'));
                }
                else {
                    for (const srcPath of paths) {
                        let relPath = path.relative(rootPath, srcPath);
                        if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
                            relPath = srcPath.replace(/^([a-zA-Z]:\\|\/)/, '');
                        }
                        const safeName = relPath.split(path.sep).join('_') + '.txt';
                        await fs.promises.copyFile(srcPath, path.join(dstDir, safeName));
                        projectStructureLines.push(path.relative(rootPath, srcPath).split(path.sep).join('/'));
                    }
                }
            }
            await fs.promises.writeFile(path.join(dstDir, 'project_structure.txt'), projectStructureLines.join('\n'), 'utf8');
        });
        vscode.window.showInformationMessage(`Exported ${files.length} files -> ${dstDir}`);
    }
}
exports.ClassicExportPipeline = ClassicExportPipeline;
//# sourceMappingURL=ClassicExportPipeline.js.map