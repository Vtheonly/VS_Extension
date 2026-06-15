"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultSplitter = void 0;
class VaultSplitter {
    parse(content, rules, defaultFolder = '', defaultFile = 'Introduction.md') {
        const segments = [];
        const compiledRules = rules.map(rule => {
            return {
                type: rule.type,
                regex: new RegExp(rule.pattern, 'm'),
                folderFormat: rule.folder_format,
                fileFormat: rule.file_format
            };
        });
        const lines = content.split(/\r?\n/);
        let currentFolder = defaultFolder;
        let currentFile = defaultFile;
        let currentContent = [];
        const saveSegment = () => {
            if (currentContent.length > 0 || currentFile !== 'Introduction.md') {
                let body = currentContent.join('\n').trim();
                if (body.endsWith('---')) {
                    body = body.slice(0, -3).trim();
                }
                if (body.startsWith('---')) {
                    body = body.slice(3).trim();
                }
                segments.push({
                    folder: currentFolder,
                    filename: currentFile,
                    content: body
                });
            }
        };
        for (const line of lines) {
            let matched = false;
            for (const rule of compiledRules) {
                const match = rule.regex.exec(line);
                if (match) {
                    saveSegment();
                    currentContent = [];
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
                    if (rule.folderFormat) {
                        currentFolder = this.interpolate(rule.folderFormat, groupDict);
                    }
                    if (rule.fileFormat) {
                        currentFile = this.interpolate(rule.fileFormat, groupDict);
                    }
                    else {
                        currentFile = 'Section.md';
                    }
                    if (!currentFile.endsWith('.md')) {
                        currentFile += '.md';
                    }
                    currentContent.push(line);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                currentContent.push(line);
            }
        }
        saveSegment();
        return segments;
    }
    interpolate(format, dict) {
        let result = format;
        for (const [k, v] of Object.entries(dict)) {
            result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        return result;
    }
}
exports.VaultSplitter = VaultSplitter;
//# sourceMappingURL=VaultSplitter.js.map