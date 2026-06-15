import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getWebviewContent } from './webviewContent';
import { getMergeWebviewContent } from './mergeWebviewContent';
import { EmojiPurgeService, PurgeSummary } from './emojiPurgeService';

// --- Shared Constants --------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set([
    '.txt', '.log', '.json', '.js', '.ts', '.jsx', '.tsx', '.py',
    '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb',
    '.go', '.rs', '.swift', '.kt', '.scala', '.sh', '.bash', '.zsh',
    '.fish', '.ps1', '.bat', '.cmd', '.html', '.htm', '.css', '.scss',
    '.sass', '.less', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.conf', '.config', '.md', '.markdown', '.rst', '.tex', '.sql', '.r',
    '.R', '.m', '.pl', '.pm', '.lua', '.vim', '.vimrc',
]);
const ALLOWED_FILENAMES = new Set([
    'Dockerfile', 'Makefile', 'README', 'LICENSE', 'CHANGELOG',
    '.gitignore', '.gitattributes', 'package.json', 'composer.json',
    'requirements.txt', 'Gemfile', 'Cargo.toml', 'pom.xml', 'build.gradle'
]);
const EXCLUDE_DIRS = new Set([
    '.git', 'node_modules', 'venv', '.ven', '.venv', '__pycache__',
    'dist', 'build', 'target', '.idea', '.vscode'
]);

// --- Shared Helpers ----------------------------------------------------------

function shouldIncludeFile(filePath: string): boolean {
    const basename = path.basename(filePath);
    const ext = path.extname(filePath);
    if (ALLOWED_EXTENSIONS.has(ext)) { return true; }
    if (ALLOWED_FILENAMES.has(basename)) { return true; }
    if (basename.startsWith('.env')) { return true; }
    return false;
}

async function traverseFiles(currentPath: string, results: string[]): Promise<void> {
    const stat = await fs.promises.stat(currentPath);
    if (stat.isDirectory()) {
        if (EXCLUDE_DIRS.has(path.basename(currentPath))) { return; }
        const children = await fs.promises.readdir(currentPath);
        for (const child of children) {
            await traverseFiles(path.join(currentPath, child), results);
        }
    } else if (stat.isFile() && shouldIncludeFile(currentPath)) {
        results.push(currentPath);
    }
}

async function pickAndScan(): Promise<{ rootPath: string; files: string[] } | undefined> {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('Please open a folder or workspace first.');
        return undefined;
    }
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const selectedUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        openLabel: 'Scan',
        canSelectFiles: true,
        canSelectFolders: true,
        defaultUri: vscode.workspace.workspaceFolders[0].uri
    });
    if (!selectedUris || selectedUris.length === 0) { return undefined; }

    const files: string[] = [];
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Scanning files...",
        cancellable: false
    }, async () => {
        for (const uri of selectedUris) {
            await traverseFiles(uri.fsPath, files);
        }
    });

    if (files.length === 0) {
        vscode.window.showInformationMessage('No matching files found.');
        return undefined;
    }

    return { rootPath, files };
}

// --- Extension Activation ----------------------------------------------------

export function activate(context: vscode.ExtensionContext) {

    // > Original Export Command -----------------------------------------------
    const exportCmd = vscode.commands.registerCommand('smart-exporter.exportFiles', async () => {
        const result = await pickAndScan();
        if (!result) { return; }
        const { rootPath, files } = result;

        const panel = vscode.window.createWebviewPanel(
            'smartExporter', 'Smart Exporter', vscode.ViewColumn.One,
            { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'out'))] }
        );

        const displayFiles = files.map(f => path.relative(rootPath, f));
        panel.webview.html = getWebviewContent(displayFiles);

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'export') {
                const abs = (message.files as string[]).map(p => path.join(rootPath, p));
                await processExport(abs, rootPath);
                panel.dispose();
            }
        }, undefined, context.subscriptions);
    });

    // > Merge & Export Command ------------------------------------------------
    const mergeCmd = vscode.commands.registerCommand('smart-exporter.mergeExport', async () => {
        const result = await pickAndScan();
        if (!result) { return; }
        const { rootPath, files } = result;

        const panel = vscode.window.createWebviewPanel(
            'smartExporterMerge', 'Merge & Export', vscode.ViewColumn.One,
            { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'out'))] }
        );

        const displayFiles = files.map(f => path.relative(rootPath, f));
        panel.webview.html = getMergeWebviewContent(displayFiles);

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'mergeExport') {
                const selectedRelative: string[] = message.files;
                const mode: string = message.mode;        // 'folder' | 'multi' | 'nuclear'
                const limitKB: number = message.fileLimitKB || 500;

                const absPaths = selectedRelative.map(p => path.join(rootPath, p));
                await processMergeExport(absPaths, rootPath, mode, limitKB);
                panel.dispose();
            }
        }, undefined, context.subscriptions);
    });

    // > Purge Emojis Command ------------------------------------------------
    const purgeCmd = vscode.commands.registerCommand('smart-exporter.purgeEmojis', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder or workspace first.');
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        const selectedUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Purge Emojis',
            canSelectFiles: true,
            canSelectFolders: true,
            defaultUri: vscode.workspace.workspaceFolders[0].uri
        });
        if (!selectedUris || selectedUris.length === 0) { return; }

        const selectedPaths = selectedUris.map(uri => uri.fsPath);

        // Create output channel for logging
        const outputChannel = vscode.window.createOutputChannel('Emoji Purge');
        outputChannel.show(true);
        outputChannel.appendLine('=== Emoji Purge Service ===');
        outputChannel.appendLine(`Scanning ${selectedPaths.length} path(s)...`);
        outputChannel.appendLine('');

        // Run the purge with progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Purging emojis...',
            cancellable: false
        }, async () => {
            const summary = await EmojiPurgeService.purgePaths(
                selectedPaths,
                (msg) => {
                    outputChannel.appendLine(msg);
                }
            );

            outputChannel.appendLine('');
            outputChannel.appendLine('=== Summary ===');
            outputChannel.appendLine(`Files scanned:   ${summary.filesScanned}`);
            outputChannel.appendLine(`Files modified:  ${summary.filesModified}`);
            outputChannel.appendLine(`Emojis removed:  ${summary.totalEmojisRemoved}`);
            outputChannel.appendLine('');

            // List all modified files
            if (summary.filesModified > 0) {
                outputChannel.appendLine('=== Modified Files ===');
                for (const r of summary.results) {
                    if (r.emojiCount > 0 && r.success) {
                        outputChannel.appendLine(`  ${r.relPath}  (${r.emojiCount} emoji chars removed)`);
                    }
                }
                outputChannel.appendLine('');
            }

            // List errors
            const errors = summary.results.filter(r => !r.success);
            if (errors.length > 0) {
                outputChannel.appendLine('=== Errors ===');
                for (const e of errors) {
                    outputChannel.appendLine(`  ${e.relPath}: ${e.error}`);
                }
                outputChannel.appendLine('');
            }

            // Show result message
            if (summary.filesModified > 0) {
                vscode.window.showInformationMessage(
                    `Purge complete: ${summary.totalEmojisRemoved} emoji chars removed from ${summary.filesModified} file(s). See output panel for details.`
                );
            } else {
                vscode.window.showInformationMessage('No emojis found in the scanned files.');
            }
        });
    });

    context.subscriptions.push(exportCmd, mergeCmd, purgeCmd);
}

// --- Original Export Logic (unchanged) ---------------------------------------

async function processExport(files: string[], rootPath: string) {
    const basenameMap = new Map<string, string[]>();
    for (const filePath of files) {
        const base = path.basename(filePath);
        if (!basenameMap.has(base)) { basenameMap.set(base, []); }
        basenameMap.get(base)!.push(filePath);
    }

    const homeDir = os.homedir();
    const projectName = path.basename(rootPath);
    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const dstDir = path.join(homeDir, 'Downloads', `${projectName}_${timestamp}`);
    if (!fs.existsSync(dstDir)) { fs.mkdirSync(dstDir, { recursive: true }); }

    const projectStructureLines: string[] = [];

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification, title: "Exporting files...", cancellable: false
    }, async () => {
        for (const [basename, paths] of basenameMap.entries()) {
            if (paths.length === 1) {
                const srcPath = paths[0];
                await fs.promises.copyFile(srcPath, path.join(dstDir, basename + '.txt'));
                projectStructureLines.push(path.relative(rootPath, srcPath).split(path.sep).join('/'));
            } else {
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

// --- Merge & Export Logic ----------------------------------------------------

/**
 * Build a visual ASCII tree from a list of relative paths.
 */
function buildTreeDiagram(relativePaths: string[]): string {
    interface TreeNode { [key: string]: TreeNode | null; }
    const root: TreeNode = {};

    for (const p of relativePaths) {
        const parts = p.split('/');
        let cur: TreeNode = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                cur[part] = null;          // file leaf
            } else {
                if (!cur[part]) { cur[part] = {}; }
                cur = cur[part] as TreeNode;
            }
        }
    }

    function render(node: TreeNode, prefix: string): string[] {
        const lines: string[] = [];
        const entries = Object.keys(node).sort((a, b) => {
            const aDir = node[a] !== null;
            const bDir = node[b] !== null;
            if (aDir && !bDir) { return -1; }
            if (!aDir && bDir) { return 1; }
            return a.localeCompare(b);
        });

        entries.forEach((key, idx) => {
            const isLast = idx === entries.length - 1;
            const connector = isLast ? '\-- ' : '|-- ';
            const child = node[key];
            if (child !== null) {
                lines.push(`${prefix}${connector} ${key}/`);
                const newPrefix = prefix + (isLast ? '    ' : '|   ');
                lines.push(...render(child, newPrefix));
            } else {
                lines.push(`${prefix}${connector}${key}`);
            }
        });
        return lines;
    }

    return render(root, '').join('\n');
}

/**
 * Return a language hint for a file extension (used in output headers).
 */
function langHint(filePath: string): string {
    const map: Record<string, string> = {
        '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
        '.py': 'python', '.java': 'java', '.c': 'c', '.cpp': 'cpp',
        '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp', '.go': 'go',
        '.rs': 'rust', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
        '.kt': 'kotlin', '.scala': 'scala', '.sh': 'bash', '.bash': 'bash',
        '.zsh': 'zsh', '.html': 'html', '.htm': 'html', '.css': 'css',
        '.scss': 'scss', '.sass': 'sass', '.less': 'less', '.xml': 'xml',
        '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.json': 'json',
        '.md': 'markdown', '.sql': 'sql', '.r': 'r', '.R': 'r',
        '.lua': 'lua', '.tex': 'latex',
    };
    return map[path.extname(filePath)] || 'text';
}

/**
 * Group files by their top-level directory for "folder" mode.
 */
function groupByFolder(relPaths: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const p of relPaths) {
        const parts = p.split('/');
        const folder = parts.length > 1 ? parts[0] : '.';
        if (!groups.has(folder)) { groups.set(folder, []); }
        groups.get(folder)!.push(p);
    }
    return groups;
}

/**
 * Build the header block for one merged output file.
 */
function buildHeader(projectName: string, sourcePaths: string[], partNum: number, totalParts: number, dateStr: string): string {
    const sourceLabel = sourcePaths.length === 1
        ? sourcePaths[0]
        : `${sourcePaths.length} paths (${sourcePaths.slice(0, 3).join(', ')}${sourcePaths.length > 3 ? '...' : ''})`;
    const partLabel = totalParts > 1 ? `Part ${partNum} of ${totalParts}` : 'Complete';

    const lines = [
        `+${'='.repeat(70)}+`,
        `|  MERGED CODE EXPORT${' '.repeat(51)}|`,
        `|  Project:  ${(projectName).padEnd(58)}|`,
        `|  Source:   ${(sourceLabel).padEnd(58)}|`,
        `|  Date:     ${(dateStr).padEnd(58)}|`,
        `|  Status:   ${(partLabel).padEnd(58)}|`,
        `+${'='.repeat(70)}+`,
    ];
    return lines.join('\n');
}

/**
 * Build the content block for a single source file, including its separator / header.
 */
function buildFileBlock(relPath: string, content: string): string {
    const sep = '='.repeat(72);
    const lang = langHint(relPath);
    return [
        '',
        sep,
        ` FILE: ${relPath}`,
        `   Language: ${lang}`,
        sep,
        '',
        content,
    ].join('\n');
}

/**
 * Core merge-export pipeline.
 */
async function processMergeExport(
    absPaths: string[],
    rootPath: string,
    mode: string,
    limitKB: number
) {
    const projectName = path.basename(rootPath);
    const dateStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const timestamp = dateStr.replace(/[: ]/g, '-');

    // Destination folder
    const dstDir = path.join(os.homedir(), 'Downloads', `${projectName}_merged_${timestamp}`);
    if (!fs.existsSync(dstDir)) { fs.mkdirSync(dstDir, { recursive: true }); }

    // Read all file contents upfront
    const relPaths = absPaths.map(p => path.relative(rootPath, p).split(path.sep).join('/'));
    const fileContents = new Map<string, string>();
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification, title: "Reading files...", cancellable: false
    }, async () => {
        for (let i = 0; i < absPaths.length; i++) {
            try {
                const content = await fs.promises.readFile(absPaths[i], 'utf8');
                fileContents.set(relPaths[i], content);
            } catch {
                fileContents.set(relPaths[i], '// [Error reading file]');
            }
        }
    });

    // Determine groups based on mode
    let groups: Map<string, string[]>;
    if (mode === 'nuclear') {
        groups = new Map([['(entire project)', relPaths]]);
    } else if (mode === 'multi') {
        groups = new Map([['(selected folders)', relPaths]]);
    } else {
        // 'folder' mode - one group per top-level directory
        groups = groupByFolder(relPaths);
    }

    const limitBytes = limitKB * 1024;
    let totalOutputFiles = 0;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification, title: "Merging & exporting...", cancellable: false
    }, async () => {
        for (const [groupName, groupFiles] of groups.entries()) {
            // Build per-file blocks
            const blocks: { relPath: string; text: string; size: number }[] = [];
            for (const rel of groupFiles) {
                const content = fileContents.get(rel) || '';
                const text = buildFileBlock(rel, content);
                blocks.push({ relPath: rel, text, size: Buffer.byteLength(text, 'utf8') });
            }

            // Split into parts based on the limit
            const parts: { relPath: string; text: string }[][] = [[]];
            let currentPartSize = 0;

            for (const block of blocks) {
                // If adding this block exceeds limit AND current part is non-empty, start new part
                if (currentPartSize + block.size > limitBytes && parts[parts.length - 1].length > 0) {
                    parts.push([]);
                    currentPartSize = 0;
                }
                parts[parts.length - 1].push(block);
                currentPartSize += block.size;
            }

            const totalParts = parts.length;

            // Derive a safe filename prefix from the group name
            const safeGroup = groupName.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+/g, '_');

            for (let partIdx = 0; partIdx < totalParts; partIdx++) {
                const partFiles = parts[partIdx];
                const partRelPaths = partFiles.map(b => b.relPath);

                const header = buildHeader(projectName, [groupName], partIdx + 1, totalParts, dateStr);
                const treeDiagram = buildTreeDiagram(partRelPaths);

                const fullContent = [
                    header,
                    '',
                    ' FOLDER STRUCTURE',
                    '-------------------',
                    treeDiagram,
                    '',
                    `This file contains the full source code of: ${groupName}`,
                    `Project root: ${rootPath}`,
                    `Total files in this part: ${partFiles.length}`,
                    '',
                    ...partFiles.map(b => b.text),
                    '',
                    `${'='.repeat(72)}`,
                    `End of merged export - ${groupName} - Part ${partIdx + 1} of ${totalParts}`,
                    `${'='.repeat(72)}`,
                ].join('\n');

                const fileName = totalParts > 1
                    ? `${safeGroup}_part_${partIdx + 1}.txt`
                    : `${safeGroup}.txt`;
                await fs.promises.writeFile(path.join(dstDir, fileName), fullContent, 'utf8');
                totalOutputFiles++;
            }
        }
    });

    vscode.window.showInformationMessage(
        ` Merged ${relPaths.length} files into ${totalOutputFiles} output file(s) -> ${dstDir}`
    );

    // Open the output folder in the OS file manager
    const uri = vscode.Uri.file(dstDir);
    vscode.env.openExternal(uri);
}

export function deactivate() { }
