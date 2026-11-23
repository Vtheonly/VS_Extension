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
exports.SelectionStateManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SelectionStateManager {
    constructor() {
        this.STATE_DIR = ".smartexport";
        this.DEFAULT_STATE_FILE = "selection-state.json";
    }
    getStateFilePath(rootPath, profileName = "default") {
        const safeProfile = profileName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
        const filename = safeProfile === "default"
            ? this.DEFAULT_STATE_FILE
            : `selection-state-${safeProfile}.json`;
        return path.join(rootPath, this.STATE_DIR, filename);
    }
    toRelativePath(rootPath, absFilePath) {
        return path
            .relative(path.resolve(rootPath), path.resolve(absFilePath))
            .replace(/\\/g, "/");
    }
    findNearestStateDirRoot(startPath, boundaryRoot) {
        let cur = path.resolve(startPath);
        try {
            if (fs.existsSync(cur) && fs.statSync(cur).isFile()) {
                cur = path.dirname(cur);
            }
        }
        catch {
            cur = path.dirname(cur);
        }
        const resolvedBoundary = boundaryRoot ? path.resolve(boundaryRoot) : null;
        while (true) {
            const candidate = path.join(cur, this.STATE_DIR);
            if (fs.existsSync(candidate)) {
                try {
                    if (fs.statSync(candidate).isDirectory()) {
                        return cur;
                    }
                }
                catch {
                    // ignore stat errors
                }
            }
            if (resolvedBoundary && cur === resolvedBoundary) {
                return null;
            }
            const parent = path.dirname(cur);
            if (parent === cur) {
                return null;
            }
            cur = parent;
        }
    }
    async saveSelection(rootPath, selectionMap, profileName = "default") {
        const stateDir = path.join(rootPath, this.STATE_DIR);
        if (!fs.existsSync(stateDir)) {
            await fs.promises.mkdir(stateDir, { recursive: true });
        }
        const stateFile = this.getStateFilePath(rootPath, profileName);
        const data = {
            version: 1,
            updatedAt: new Date().toISOString(),
            profile: profileName,
            files: selectionMap,
        };
        await fs.promises.writeFile(stateFile, JSON.stringify(data, null, 2), "utf8");
        return stateFile;
    }
    async loadSelection(rootPath, profileName = "default") {
        const stateFile = this.getStateFilePath(rootPath, profileName);
        if (!fs.existsSync(stateFile)) {
            return null;
        }
        try {
            const raw = await fs.promises.readFile(stateFile, "utf8");
            const data = JSON.parse(raw);
            return data.files || null;
        }
        catch {
            return null;
        }
    }
    async isFileIncluded(rootPath, relPath, defaultIncluded = true, profileName = "default") {
        const existing = await this.loadSelection(rootPath, profileName);
        if (!existing || existing[relPath] === undefined) {
            return defaultIncluded;
        }
        return existing[relPath];
    }
    async toggleFile(rootPath, relPath, defaultIncluded = true, profileName = "default") {
        const existing = (await this.loadSelection(rootPath, profileName)) || {};
        const current = existing[relPath] !== undefined ? existing[relPath] : defaultIncluded;
        const next = !current;
        const updated = {
            ...existing,
            [relPath]: next,
        };
        const stateFile = await this.saveSelection(rootPath, updated, profileName);
        return { included: next, files: updated, stateFile };
    }
    async toggleBatch(rootPath, items, profileName = "default") {
        const existing = (await this.loadSelection(rootPath, profileName)) || {};
        if (items.length === 0) {
            return {
                included: false,
                files: existing,
                stateFile: this.getStateFilePath(rootPath, profileName),
                count: 0,
            };
        }
        const allCurrentlyIncluded = items.every((item) => {
            const cur = existing[item.relPath] !== undefined
                ? existing[item.relPath]
                : item.defaultIncluded;
            return cur === true;
        });
        const next = !allCurrentlyIncluded;
        const updated = { ...existing };
        for (const item of items) {
            updated[item.relPath] = next;
        }
        const stateFile = await this.saveSelection(rootPath, updated, profileName);
        return {
            included: next,
            files: updated,
            stateFile,
            count: items.length,
        };
    }
    async listProfiles(rootPath) {
        const stateDir = path.join(rootPath, this.STATE_DIR);
        if (!fs.existsSync(stateDir)) {
            return ["default"];
        }
        const files = await fs.promises.readdir(stateDir);
        const profiles = ["default"];
        for (const file of files) {
            if (file === this.DEFAULT_STATE_FILE)
                continue;
            const match = file.match(/^selection-state-(.+)\.json$/);
            if (match && match[1]) {
                profiles.push(match[1]);
            }
        }
        return Array.from(new Set(profiles));
    }
}
exports.SelectionStateManager = SelectionStateManager;
//# sourceMappingURL=SelectionStateManager.js.map