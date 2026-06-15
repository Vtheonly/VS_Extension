/**
 * Emoji Purging Service.
 * TypeScript port of the Python EmojiPurgeService from split_merge.
 * Removes all emoji characters from file content with binary-safe file detection.
 */

import * as fs from 'fs';
import * as path from 'path';

// Comprehensive emoji regex covering all Unicode emoji ranges (ported from Python)
const EMOJI_REGEX = new RegExp(
    '['
    + '\u{1F600}-\u{1F64F}'  // Emoticons
    + '\u{1F300}-\u{1F5FF}'  // Misc Symbols and Pictographs
    + '\u{1F680}-\u{1F6FF}'  // Transport and Map
    + '\u{1F700}-\u{1F77F}'  // Alchemical Symbols
    + '\u{1F780}-\u{1F7FF}'  // Geometric Shapes Extended
    + '\u{1F800}-\u{1F8FF}'  // Supplemental Arrows-C
    + '\u{1F900}-\u{1F9FF}'  // Supplemental Symbols and Pictographs
    + '\u{1FA00}-\u{1FA6F}'  // Chess Symbols
    + '\u{1FA70}-\u{1FAFF}'  // Symbols and Pictographs Extended-A
    + '\u{2702}-\u{27B0}'    // Dingbats
    + '\u{27BF}'             // Dingbat arrow
    + '\u{FE00}-\u{FE0F}'    // Variation Selectors
    + '\u{200D}'             // Zero Width Joiner
    + '\u{2600}-\u{26FF}'    // Misc Symbols
    + '\u{2300}-\u{23FF}'    // Misc Technical
    + '\u{2B50}'             // Star
    + '\u{2B05}-\u{2B07}'    // Arrows
    + '\u{2934}-\u{2935}'    // Arrows
    + '\u{3030}'             // Wavy dash
    + '\u{25AA}-\u{25AB}'    // Small squares
    + '\u{25FB}-\u{25FE}'    // Medium squares
    + '\u{25B6}'             // Play button
    + '\u{25C0}'             // Reverse play
    + '\u{203C}'             // Double exclamation
    + '\u{2049}'             // Exclamation question
    + '\u{2139}'             // Info
    + '\u{2194}-\u{2199}'    // Arrows
    + '\u{21A9}-\u{21AA}'    // Arrows
    + '\u{231A}-\u{231B}'    // Watch, Hourglass
    + '\u{23E9}-\u{23F3}'    // Media controls
    + '\u{23F8}-\u{23FA}'    // Media controls
    + '\u{24C2}'             // Circled M
    + '\u{2660}'             // Spade
    + '\u{2663}'             // Club
    + '\u{2665}-\u{2666}'    // Heart, Diamond
    + '\u{2668}'             // Hot springs
    + '\u{267B}'             // Recycling
    + '\u{267F}'             // Wheelchair
    + '\u{2692}-\u{2697}'    // Tools
    + '\u{2699}'             // Gear
    + '\u{269B}-\u{269C}'    // Atom, Fleur-de-lis
    + '\u{26A0}-\u{26A1}'    // Warning, Zap
    + '\u{26AA}-\u{26AB}'    // Circles
    + '\u{26B0}-\u{26B1}'    // Coffin, Urn
    + '\u{26BD}-\u{26BE}'    // Soccer, Baseball
    + '\u{26C4}-\u{26C5}'    // Snowman, Sun
    + '\u{26CE}'             // Ophiuchus
    + '\u{26CF}-\u{26D4}'    // Tools, No entry
    + '\u{26E9}-\u{26EA}'    // Shinto, Church
    + '\u{26F0}-\u{26F5}'    // Mountain, Sailboat
    + '\u{26F7}-\u{26FA}'    // Skier, Tent
    + '\u{26FD}'             // Fuel pump
    + '\u{2702}'             // Scissors
    + '\u{2705}'             // Check mark
    + '\u{2708}-\u{270D}'    // Airplane, Writing hand
    + '\u{270F}'             // Pencil
    + '\u{2712}'             // Black nib
    + '\u{2714}'             // Check mark
    + '\u{2716}'             // Cross mark
    + '\u{271D}'             // Latin cross
    + '\u{2721}'             // Star of David
    + '\u{2728}'             // Sparkles
    + '\u{2733}-\u{2734}'    // Eight spoked asterisk
    + '\u{2744}'             // Snowflake
    + '\u{2747}'             // Sparkle
    + '\u{274C}'             // Cross mark
    + '\u{274E}'             // Cross mark
    + '\u{2753}-\u{2755}'    // Question marks
    + '\u{2757}'             // Exclamation
    + '\u{2763}-\u{2764}'    // Heart exclamation, Heart
    + '\u{2795}-\u{2797}'    // Plus, Minus, Divide
    + '\u{27A1}'             // Right arrow
    + '\u{2934}-\u{2935}'    // Curved arrows
    + '\u{2B05}-\u{2B07}'    // Arrows
    + '\u{2B1B}-\u{2B1C}'    // Black/white squares
    + '\u{2B55}'             // Circle
    + '\u{1F004}'             // Mahjong
    + '\u{1F0CF}'             // Playing card
    + '\u{1F170}-\u{1F171}'  // A/B buttons
    + '\u{1F17E}-\u{1F17F}'  // O/P buttons
    + '\u{1F18E}'             // AB button
    + '\u{1F191}-\u{1F19A}'  // Squared words
    + '\u{1F1E0}-\u{1F1FF}'  // Regional indicators (flags)
    + '\u{1F201}-\u{1F202}'  // Japanese symbols
    + '\u{1F21A}'             // Japanese "free"
    + '\u{1F22F}'             // Japanese "congratulations"
    + '\u{1F232}-\u{1F23A}'  // Japanese symbols
    + '\u{1F250}-\u{1F251}'  // Japanese symbols
    + '\u{E0020}-\u{E007F}'  // Tags (flag sequences)
    + '\u{FE0F}'             // Variation selector-16 (emoji presentation)
    + ']',
    'gu'
);

/**
 * Set of text file extensions to include for scanning.
 */
const TEXT_EXTENSIONS = new Set([
    '.md', '.markdown', '.txt', '.text', '.log',
    '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
    '.json', '.xml', '.xhtml', '.svg', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.conf', '.csv', '.tsv',
    '.py', '.pyw', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
    '.go', '.rs', '.swift', '.kt', '.kts', '.scala', '.php', '.pl', '.pm',
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

/**
 * Result of purging emojis from a single file.
 */
export interface PurgeFileResult {
    /** Relative path from the scan root */
    relPath: string;
    /** Number of emoji characters removed */
    emojiCount: number;
    /** Whether the operation succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
}

/**
 * Summary of a purge operation.
 */
export interface PurgeSummary {
    filesScanned: number;
    filesModified: number;
    totalEmojisRemoved: number;
    results: PurgeFileResult[];
}

/**
 * Service that removes emoji characters from text files.
 * Ported from the Python EmojiPurgeService in the split_merge project.
 */
export class EmojiPurgeService {

    /**
     * Remove all emoji characters from the given content string.
     */
    public static removeEmojis(content: string): string {
        return content.replace(EMOJI_REGEX, '');
    }

    /**
     * Count the number of emoji characters in the content.
     */
    public static countEmojis(content: string): number {
        const matches = content.match(EMOJI_REGEX);
        if (!matches) return 0;
        return matches.reduce((sum, m) => sum + m.length, 0);
    }

    /**
     * Check whether a file should be treated as text based on extension or filename.
     */
    public static isTextFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath);

        if (TEXT_EXTENSIONS.has(ext)) return true;
        if (TEXT_FILENAMES.has(basename)) return true;
        if (basename.startsWith('.env')) return true;

        // No recognized extension - check if binary by looking for null bytes
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

    /**
     * Recursively find all text files in a directory.
     */
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

    /**
     * Scan a set of paths (files and/or directories) and purge emojis from all
     * text files found. Returns a summary of the operation.
     */
    public static async purgePaths(
        paths: string[],
        onProgress?: (message: string) => void
    ): Promise<PurgeSummary> {
        const report = (msg: string) => { if (onProgress) onProgress(msg); };

        // Collect all text files
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

        // Deduplicate
        const uniqueFiles = [...new Set(allFiles)];
        report(`Found ${uniqueFiles.length} text file(s) to scan.`);

        const results: PurgeFileResult[] = [];
        let filesModified = 0;
        let totalEmojisRemoved = 0;

        // Determine common root for relative paths
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

    /**
     * Find the common ancestor directory from a list of paths.
     */
    private static findCommonRoot(paths: string[]): string | null {
        if (paths.length === 0) return null;
        if (paths.length === 1) {
            const stat = fs.statSync(paths[0]);
            return stat.isDirectory() ? paths[0] : path.dirname(paths[0]);
        }

        // Split all paths into parts
        const splitPaths = paths.map(p => p.split(path.sep));

        // Find common prefix
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