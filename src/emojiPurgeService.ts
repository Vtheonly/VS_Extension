import * as fs from 'fs';
import * as path from 'path';
import { IEmojiPurgeService } from './core/interfaces';

// Modern Unicode property escapes regex targeting pictographs, flags, modifiers, selectors, and ZWJ elements
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]/gu;

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

export interface PurgeFileResult {
    relPath: string;
    emojiCount: number;
    success: boolean;
    error?: string;
}

export interface PurgeSummary {
    filesScanned: number;
    filesModified: number;
    totalEmojisRemoved: number;
    results: PurgeFileResult[];
}

export class EmojiPurgeService implements IEmojiPurgeService {
    public static removeEmojis(content: string): string {
        return content.replace(EMOJI_REGEX, '');
    }

    public static countEmojis(content: string): number {
        const matches = content.match(EMOJI_REGEX);
        if (!matches) return 0;
        return matches.length;
    }

    public static isTextFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath);

        if (TEXT_EXTENSIONS.has(ext)) return true;
        if (TEXT_FILENAMES.has(basename)) return true;
        if (basename.startsWith('.env')) return true;

        if (!ext) {
            try {
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(1024);
                const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
                fs.closeSync(fd);
                const chunk = buffer.subarray(0, bytesRead);
                return !chunk.includes(0x00);
            } catch {
                return false;
            }
        }
        return false;
    }

    public static async findTextFiles(dirPath: string): Promise<string[]> {
        const results: string[] = [];
        async function walk(currentPath: string) {
            const stat = await fs.promises.stat(currentPath);
            if (stat.isDirectory()) {
                const basename = path.basename(currentPath);
                if (EXCLUDE_DIRS.has(basename) || basename.startsWith('.')) return;

                const children = await fs.promises.readdir(currentPath);
                for (const child of children) {
                    await walk(path.join(currentPath, child));
                }
            } else if (stat.isFile() && EmojiPurgeService.isTextFile(currentPath)) {
                results.push(currentPath);
            }
        }
        await walk(dirPath);
        return results;
    }

    public async purgePaths(
        paths: string[],
        onProgress?: (msg: string) => void
    ): Promise<PurgeSummary> {
        return EmojiPurgeService.purgePaths(paths, onProgress);
    }

    public static async purgePaths(
        paths: string[],
        onProgress?: (message: string) => void
    ): Promise<PurgeSummary> {
        const report = (msg: string) => { if (onProgress) onProgress(msg); };

        const allFiles: string[] = [];
        for (const p of paths) {
            const stat = await fs.promises.stat(p);
            if (stat.isDirectory()) {
                const files = await EmojiPurgeService.findTextFiles(p);
                allFiles.push(...files);
            } else if (stat.isFile() && EmojiPurgeService.isTextFile(p)) {
                allFiles.push(p);
            }
        }

        const uniqueFiles = [...new Set(allFiles)];
        report(`Found ${uniqueFiles.length} text file(s) to scan.`);

        const results: PurgeFileResult[] = [];
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
            } catch (err: any) {
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

    private static findCommonRoot(paths: string[]): string | null {
        if (paths.length === 0) return null;
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