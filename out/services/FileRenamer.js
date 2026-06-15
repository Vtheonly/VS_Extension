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
exports.FileRenamer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileRenamer {
    generateMapMapping(currentFiles, mappingDict) {
        const mapping = {};
        for (const [k, v] of Object.entries(mappingDict)) {
            if (currentFiles.includes(k)) {
                mapping[k] = v;
            }
        }
        return mapping;
    }
    generateRegexMapping(currentFiles, patternStr, replacementFormat) {
        const regex = new RegExp(patternStr);
        const mapping = {};
        for (const f of currentFiles) {
            const match = regex.exec(f);
            if (match) {
                const groupDict = {};
                for (let i = 1; i < match.length; i++) {
                    if (match[i] !== undefined) {
                        groupDict[`g${i}`] = match[i].trim();
                    }
                }
                if (match.groups) {
                    for (const [k, v] of Object.entries(match.groups)) {
                        if (v !== undefined) {
                            groupDict[k] = v.trim();
                        }
                    }
                }
                let newName = replacementFormat;
                for (const [k, v] of Object.entries(groupDict)) {
                    newName = newName.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
                }
                if (!newName.endsWith('.md') && f.endsWith('.md')) {
                    newName += '.md';
                }
                mapping[f] = newName;
            }
        }
        return mapping;
    }
    async executeRename(targetDir, mapping) {
        const tempMappings = {};
        let tempCounter = 0;
        for (const [oldName, newName] of Object.entries(mapping)) {
            const oldPath = path.join(targetDir, oldName);
            if (!fs.existsSync(oldPath))
                continue;
            const tempName = `rename_temp_${Date.now()}_${tempCounter++}.tmp`;
            const tempPath = path.join(targetDir, tempName);
            await fs.promises.rename(oldPath, tempPath);
            tempMappings[tempName] = newName;
        }
        for (const [tempName, newName] of Object.entries(tempMappings)) {
            const tempPath = path.join(targetDir, tempName);
            const finalPath = path.join(targetDir, newName);
            const destDir = path.dirname(finalPath);
            if (!fs.existsSync(destDir)) {
                await fs.promises.mkdir(destDir, { recursive: true });
            }
            await fs.promises.rename(tempPath, finalPath);
        }
    }
}
exports.FileRenamer = FileRenamer;
//# sourceMappingURL=FileRenamer.js.map