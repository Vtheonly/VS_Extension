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
exports.EmojiPurgeService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const EMOJI_REGEX = new RegExp('['
    + '\u{1F600}-\u{1F64F}'
    + '\u{1F300}-\u{1F5FF}'
    + '\u{1F680}-\u{1F6FF}'
    + '\u{1F700}-\u{1F77F}'
    + '\u{1F780}-\u{1F7FF}'
    + '\u{1F800}-\u{1F8FF}'
    + '\u{1F900}-\u{1F9FF}'
    + '\u{1FA00}-\u{1FA6F}'
    + '\u{1FA70}-\u{1FAFF}'
    + '\u{2702}-\u{27B0}'
    + '\u{27BF}'
    + '\u{FE00}-\u{FE0F}'
    + '\u{200D}'
    + '\u{2600}-\u{26FF}'
    + '\u{2300}-\u{23FF}'
    + '\u{2B50}'
    + '\u{2B05}-\u{2B07}'
    + '\u{2934}-\u{2935}'
    + '\u{3030}'
    + '\u{25AA}-\u{25AB}'
    + '\u{25FB}-\u{25FE}'
    + '\u{25B6}'
    + '\u{25C0}'
    + '\u{203C}'
    + '\u{2049}'
    + '\u{2139}'
    + '\u{2194}-\u{2199}'
    + '\u{21A9}-\u{21AA}'
    + '\u{231A}-\u{231B}'
    + '\u{23E9}-\u{23F3}'
    + '\u{23F8}-\u{23FA}'
    + '\u{24C2}'
    + '\u{2660}'
    + '\u{2663}'
    + '\u{2665}-\u{2666}'
    + '\u{2668}'
    + '\u{267B}'
    + '\u{267F}'
    + '\u{2692}-\u{2697}'
    + '\u{2699}'
    + '\u{269B}-\u{269C}'
    + '\u{26A0}-\u{26A1}'
    + '\u{26AA}-\u{26AB}'
    + '\u{26B0}-\u{26B1}'
    + '\u{26BD}-\u{26BE}'
    + '\u{26C4}-\u{26C5}'
    + '\u{26CE}'
    + '\u{26CF}-\u{26D4}'
    + '\u{26E9}-\u{26EA}'
    + '\u{26F0}-\u{26F5}'
    + '\u{26F7}-\u{26FA}'
    + '\u{26FD}'
    + '\u{2702}'
    + '\u{2705}'
    + '\u{2708}-\u{270D}'
    + '\u{270F}'
    + '\u{2712}'
    + '\u{2714}'
    + '\u{2716}'
    + '\u{271D}'
    + '\u{2721}'
    + '\u{2728}'
    + '\u{2733}-\u{2734}'
    + '\u{2744}'
    + '\u{2747}'
    + '\u{274C}'
    + '\u{274E}'
    + '\u{2753}-\u{2755}'
    + '\u{2757}'
    + '\u{2763}-\u{2764}'
    + '\u{2795}-\u{2797}'
    + '\u{27A1}'
    + '\u{2934}-\u{2935}'
    + '\u{2B05}-\u{2B07}'
    + '\u{2B1B}-\u{2B1C}'
    + '\u{2B55}'
    + '\u{1F004}'
    + '\u{1F0CF}'
    + '\u{1F170}-\u{1F171}'
    + '\u{1F17E}-\u{1F17F}'
    + '\u{1F18E}'
    + '\u{1F191}-\u{1F19A}'
    + '\u{1F1E0}-\u{1F1FF}'
    + '\u{1F201}-\u{1F202}'
    + '\u{1F21A}'
    + '\u{1F22F}'
    + '\u{1F232}-\u{1F23A}'
    + '\u{1F250}-\u{1F251}'
    + '\u{E0020}-\u{E007F}'
    + '\u{FE0F}'
    + ']', 'gu');
const TEXT_EXTENSIONS = new Set([
    '.md', '.markdown', '.txt', '.text', '.log',
    '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
    '.json', '.xml', '.xhtml', '.svg', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.conf', '.csv', '.tsv',
    '.py', '.pyw', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
    '.go', '.rs', '.swift', '.kt', '.scala', '.php', '.pl', '.pm',
    '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
    '.sql', '.graphql', '.gql',
    '.tex', '.bib', '.rst', '.adoc', '.org',
    '.env', '.gitignore', '.dockerignore', '.editorconfig',
    '.lua', '.vim', '.el', '.clj', '.cljs', '.edn',
    '.sass', '.scss', '.less', '.styl',
    '.pug', '.jade', '.ejs', '.hbs', '.mustache', '.njk',
    '.vue', '.svelte', '.astro',
]);
const TEXT_FILENAMES = new Set([
    'Makefile', 'Dockerfile', 'Vagrantfile', 'Gemfile', 'Rakefile',
    'README', 'LICENSE', 'CHANGELOG', 'CONTRIBUTING', 'AUTHORS',
    '.gitignore', '.dockerignore', '.env', '.editorconfig',
]);
const EXCLUDE_DIRS = new Set([
    '.git', 'node_modules', '__pycache__', 'venv', '.venv', '.ven',
    'dist', 'build', 'target', '.idea', '.vscode', '.vs',
    'out', 'bin', 'obj',
]);
class EmojiPurgeService {
    static removeEmojis(content) {
        return content.replace(EMOJI_REGEX, '');
    }
    static countEmojis(content) {
        const matches = content.match(EMOJI_REGEX);
        if (!matches)
            return 0;
        return matches.reduce((sum, m) => sum + m.length, 0);
    }
    static isTextFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath);
        if (TEXT_EXTENSIONS.has(ext))
            return true;
        if (TEXT_FILENAMES.has(basename))
            return true;
        if (basename.startsWith('.env'))
            return true;
        if (!ext) {
            try {
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(1024);
                const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
                fs.closeSync(fd);
                const chunk = buffer.subarray(0, bytesRead);
                return !chunk.includes(0x00);
            }
            catch {
                return false;
            }
        }
        return false;
    }
    static async findTextFiles(dirPath) {
        const results = [];
        async function walk(currentPath) {
            const stat = await fs.promises.stat(currentPath);
            if (stat.isDirectory()) {
                const basename = path.basename(currentPath);
                if (EXCLUDE_DIRS.has(basename) || basename.startsWith('.'))
                    return;
                const children = await fs.promises.readdir(currentPath);
                for (const child of children) {
                    await walk(path.join(currentPath, child));
                }
            }
            else if (stat.isFile() && EmojiPurgeService.isTextFile(currentPath)) {
                results.push(currentPath);
            }
        }
        await walk(dirPath);
        return results;
    }
    async purgePaths(paths, onProgress) {
        return EmojiPurgeService.purgePaths(paths, onProgress);
    }
    static async purgePaths(paths, onProgress) {
        const report = (msg) => { if (onProgress)
            onProgress(msg); };
        const allFiles = [];
        for (const p of paths) {
            const stat = await fs.promises.stat(p);
            if (stat.isDirectory()) {
                const files = await EmojiPurgeService.findTextFiles(p);
                allFiles.push(...files);
            }
            else if (stat.isFile() && EmojiPurgeService.isTextFile(p)) {
                allFiles.push(p);
            }
        }
        const uniqueFiles = [...new Set(allFiles)];
        report(`Found ${uniqueFiles.length} text file(s) to scan.`);
        const results = [];
        let filesModified = 0;
        let totalEmojisRemoved = 0;
        const commonRoot = EmojiPurgeService.findCommonRoot(paths);
        for (const filePath of uniqueFiles) {
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const emojiCount = EmojiPurgeService.countEmojis(content);
                if (emojiCount === 0) {
                    results.push({
                        relPath: path.relative(commonRoot || path.dirname(filePath), filePath),
                        emojiCount: 0,
                        success: true,
                    });
                    continue;
                }
                const cleaned = EmojiPurgeService.removeEmojis(content);
                await fs.promises.writeFile(filePath, cleaned, 'utf8');
                const relPath = path.relative(commonRoot || path.dirname(filePath), filePath);
                results.push({ relPath, emojiCount, success: true });
                filesModified++;
                totalEmojisRemoved += emojiCount;
                report(`Purged ${emojiCount} emoji char(s) from: ${relPath}`);
            }
            catch (err) {
                results.push({
                    relPath: filePath,
                    emojiCount: 0,
                    success: false,
                    error: err.message || 'Unknown error',
                });
                report(`Error processing '${filePath}': ${err.message}`);
            }
        }
        return {
            filesScanned: uniqueFiles.length,
            filesModified,
            totalEmojisRemoved,
            results,
        };
    }
    static findCommonRoot(paths) {
        if (paths.length === 0)
            return null;
        if (paths.length === 1) {
            const stat = fs.statSync(paths[0]);
            return stat.isDirectory() ? paths[0] : path.dirname(paths[0]);
        }
        const splitPaths = paths.map(p => p.split(path.sep));
        let common = splitPaths[0];
        for (let i = 1; i < splitPaths.length; i++) {
            const current = splitPaths[i];
            let j = 0;
            while (j < common.length && j < current.length && common[j] === current[j]) {
                j++;
            }
            common = common.slice(0, j);
        }
        const root = common.join(path.sep);
        return root || null;
    }
}
exports.EmojiPurgeService = EmojiPurgeService;
//# sourceMappingURL=emojiPurgeService.js.map