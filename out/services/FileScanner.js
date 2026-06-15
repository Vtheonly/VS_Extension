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
exports.FileScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileScanner {
    constructor(allowedExtensions, allowedFilenames, excludeDirs) {
        this.allowedExtensions = allowedExtensions;
        this.allowedFilenames = allowedFilenames;
        this.excludeDirs = excludeDirs;
    }
    async scan(paths) {
        const results = [];
        for (const p of paths) {
            try {
                await this.traverse(p, results);
            }
            catch {
                // Fail-safe file access bounds handling
            }
        }
        return results;
    }
    shouldIncludeFile(filePath) {
        const basename = path.basename(filePath);
        const ext = path.extname(filePath);
        if (this.allowedExtensions.has(ext)) {
            return true;
        }
        if (this.allowedFilenames.has(basename)) {
            return true;
        }
        if (basename.startsWith('.env')) {
            return true;
        }
        return false;
    }
    async traverse(currentPath, results) {
        const stat = await fs.promises.stat(currentPath);
        if (stat.isDirectory()) {
            if (this.excludeDirs.has(path.basename(currentPath))) {
                return;
            }
            const children = await fs.promises.readdir(currentPath);
            for (const child of children) {
                await this.traverse(path.join(currentPath, child), results);
            }
        }
        else if (stat.isFile() && this.shouldIncludeFile(currentPath)) {
            results.push(currentPath);
        }
    }
}
exports.FileScanner = FileScanner;
//# sourceMappingURL=FileScanner.js.map