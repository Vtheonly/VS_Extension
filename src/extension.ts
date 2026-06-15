import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileScanner } from './services/FileScanner';
import { ClassicExportPipeline } from './services/ClassicExportPipeline';
import { MergeExportPipeline } from './services/MergeExportPipeline';
import { EmojiPurgeService } from './emojiPurgeService';
import { getWebviewContent } from './webviewContent';
import { getMergeWebviewContent } from './mergeWebviewContent';

// New services
import { VaultSplitter } from './services/VaultSplitter';
import { VaultMerger } from './services/VaultMerger';
import { MermaidFixer } from './services/MermaidFixer';
import { QuizValidator } from './services/QuizValidator';
import { FileRenamer } from './services/FileRenamer';
import { SplitRule } from './core/interfaces';

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

// Default split rules
const DEFAULT_SPLIT_RULES: SplitRule[] = [
    {
        type: 'chapter',
        pattern: '^#\\s+Chapter\\s+(\\d+)\\.\\s*(.*)',
        folder_format: 'Chapter {g1}. {g2}',
        file_format: '00 Introduction.md'
    },
    {
        type: 'section',
        pattern: '^##\\s+(\\d+)\\.\\s*(.*)',
        folder_format: '',
        file_format: '{g1}. {g2}.md'
    }
];

// --- Dependency Orchestration ------------------------------------------------

const fileScanner = new FileScanner(ALLOWED_EXTENSIONS, ALLOWED_FILENAMES, EXCLUDE_DIRS);
const classicExporter = new ClassicExportPipeline();
const mergeExporter = new MergeExportPipeline();

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
        const paths = selectedUris.map(uri => uri.fsPath);
        const scanned = await fileScanner.scan(paths);
        files.push(...scanned);
    });

    if (files.length === 0) {
        vscode.window.showInformationMessage('No matching files found.');
        return undefined;
    }

    return { rootPath, files };
}

// Simple YAML parsers
function parseYamlSplitRules(yamlContent: string): SplitRule[] | null {
    const rules: SplitRule[] = [];
    const lines = yamlContent.split(/\r?\n/);
    let inRules = false;
    let currentRule: Partial<SplitRule> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('rules:')) {
            inRules = true;
            continue;
        }
        if (inRules) {
            if (trimmed.startsWith('-')) {
                if (currentRule.pattern) {
                    rules.push(currentRule as SplitRule);
                }
                currentRule = {};
            }
            
            const match = /^\s*-\s*(\w+):\s*(.*)/.exec(line) || /^\s*(\w+):\s*(.*)/.exec(line);
            if (match) {
                const key = match[1];
                let val = match[2].trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                if (match[2].startsWith('"')) {
                    val = val.replace(/\\\\/g, '\\');
                }
                if (key === 'type') currentRule.type = val;
                else if (key === 'pattern') currentRule.pattern = val;
                else if (key === 'folder_format') currentRule.folder_format = val;
                else if (key === 'file_format') currentRule.file_format = val;
            }
        }
    }
    if (currentRule.pattern) {
        rules.push(currentRule as SplitRule);
    }
    return rules.length > 0 ? rules : null;
}

function parseYamlRenameConfigs(yamlContent: string): Record<string, any> | null {
    const configs: Record<string, any> = {};
    const lines = yamlContent.split(/\r?\n/);
    let inRename = false;
    let currentPipeline = '';
    let currentMapping: Record<string, string> = {};
    let inMapping = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (line.startsWith('rename:')) {
            inRename = true;
            continue;
        }
        if (inRename) {
            if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
                inRename = false;
                continue;
            }

            const pipelineMatch = /^  (\w+):/.exec(line);
            if (pipelineMatch) {
                if (currentPipeline && Object.keys(currentMapping).length > 0) {
                    configs[currentPipeline].mapping = currentMapping;
                }
                currentPipeline = pipelineMatch[1];
                configs[currentPipeline] = {};
                currentMapping = {};
                inMapping = false;
                continue;
            }

            if (currentPipeline) {
                const fieldMatch = /^\s*(\w+):\s*(.*)/.exec(line);
                if (fieldMatch) {
                    const key = fieldMatch[1];
                    let val = fieldMatch[2].trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (key === 'mapping') {
                        inMapping = true;
                        continue;
                    }
                    if (!inMapping) {
                        configs[currentPipeline][key] = val;
                    }
                }

                if (inMapping && trimmed) {
                    const mapMatch = /^\s*(["']?.*?["']?):\s*(["']?.*?["']?)$/.exec(line);
                    if (mapMatch) {
                        let k = mapMatch[1].trim();
                        let v = mapMatch[2].trim();
                        if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
                            k = k.slice(1, -1);
                        }
                        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                            v = v.slice(1, -1);
                        }
                        currentMapping[k] = v;
                    }
                }
            }
        }
    }

    if (currentPipeline && Object.keys(currentMapping).length > 0) {
        configs[currentPipeline].mapping = currentMapping;
    }

    return Object.keys(configs).length > 0 ? configs : null;
}

export function activate(context: vscode.ExtensionContext) {

    // --- Classic Exporter command ------------------------------------------
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
                await classicExporter.execute(abs, rootPath);
                panel.dispose();
            }
        }, undefined, context.subscriptions);
    });

    // --- Merge & Exporter command -----------------------------------------
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
                const mode: string = message.mode;
                const limitKB: number = message.fileLimitKB || 500;

                const absPaths = selectedRelative.map(p => path.join(rootPath, p));
                await mergeExporter.execute(absPaths, rootPath, mode, limitKB);
                panel.dispose();
            }
        }, undefined, context.subscriptions);
    });

    // --- Emoji Purging Tool command -----------------------------------------
    const purgeCmd = vscode.commands.registerCommand('smart-exporter.purgeEmojis', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder or workspace first.');
            return;
        }

        const selectedUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Purge Emojis',
            canSelectFiles: true,
            canSelectFolders: true,
            defaultUri: vscode.workspace.workspaceFolders[0].uri
        });
        if (!selectedUris || selectedUris.length === 0) { return; }

        const selectedPaths = selectedUris.map(uri => uri.fsPath);

        const outputChannel = vscode.window.createOutputChannel('Emoji Purge');
        outputChannel.show(true);
        outputChannel.appendLine('=== Emoji Purge Service ===');
        outputChannel.appendLine(`Scanning ${selectedPaths.length} path(s)...`);
        outputChannel.appendLine('');

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

            if (summary.filesModified > 0) {
                outputChannel.appendLine('=== Modified Files ===');
                for (const r of summary.results) {
                    if (r.emojiCount > 0 && r.success) {
                        outputChannel.appendLine(`  ${r.relPath}  (${r.emojiCount} emoji chars removed)`);
                    }
                }
                outputChannel.appendLine('');
            }

            const errors = summary.results.filter(r => !r.success);
            if (errors.length > 0) {
                outputChannel.appendLine('=== Errors ===');
                for (const e of errors) {
                    outputChannel.appendLine(`  ${e.relPath}: ${e.error}`);
                }
                outputChannel.appendLine('');
            }

            if (summary.filesModified > 0) {
                vscode.window.showInformationMessage(
                    `Purge complete: ${summary.totalEmojisRemoved} emoji chars removed from ${summary.filesModified} file(s). See output panel for details.`
                );
            } else {
                vscode.window.showInformationMessage('No emojis found in the scanned files.');
            }
        });
    });

    // --- Split Vault Document command ---------------------------------------
    const splitVaultCmd = vscode.commands.registerCommand('smart-exporter.splitVault', async () => {
        const sourceUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Markdown File to Split',
            filters: { 'Markdown': ['md', 'markdown'] }
        });
        if (!sourceUris || sourceUris.length === 0) { return; }
        const sourceFile = sourceUris[0].fsPath;

        const targetUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Target Folder for Split Segments',
            canSelectFiles: false,
            canSelectFolders: true
        });
        if (!targetUris || targetUris.length === 0) { return; }
        const targetDir = targetUris[0].fsPath;

        let rules = DEFAULT_SPLIT_RULES;
        let configPath = path.join(path.dirname(sourceFile), 'config.yaml');
        if (!fs.existsSync(configPath) && vscode.workspace.workspaceFolders) {
            configPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'config.yaml');
        }
        if (fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                rules = parseYamlSplitRules(configContent) || DEFAULT_SPLIT_RULES;
            } catch (e) { }
        }

        const outputChannel = vscode.window.createOutputChannel('Vault Splitter');
        outputChannel.show(true);
        outputChannel.appendLine('=== Vault Splitter ===');
        outputChannel.appendLine(`Source file: ${sourceFile}`);
        outputChannel.appendLine(`Target directory: ${targetDir}`);
        outputChannel.appendLine('');

        try {
            const content = fs.readFileSync(sourceFile, 'utf8');
            const splitter = new VaultSplitter();
            const segments = splitter.parse(content, rules);

            outputChannel.appendLine(`Parsed ${segments.length} segments.`);
            
            for (const segment of segments) {
                const destFolder = path.join(targetDir, segment.folder);
                if (!fs.existsSync(destFolder)) {
                    fs.mkdirSync(destFolder, { recursive: true });
                }
                const destFile = path.join(destFolder, segment.filename);
                fs.writeFileSync(destFile, segment.content, 'utf8');
                outputChannel.appendLine(`  Created: ${path.join(segment.folder, segment.filename)}`);
            }

            vscode.window.showInformationMessage(`Successfully split into ${segments.length} segments in ${targetDir}`);
        } catch (err: any) {
            outputChannel.appendLine(`Error: ${err.message}`);
            vscode.window.showErrorMessage(`Split failed: ${err.message}`);
        }
    });

    // --- Merge Vault Workspace command ---------------------------------------
    const mergeVaultCmd = vscode.commands.registerCommand('smart-exporter.mergeVault', async () => {
        const sourceUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Markdown File to Split and Merge',
            filters: { 'Markdown': ['md', 'markdown'] }
        });
        if (!sourceUris || sourceUris.length === 0) { return; }
        const sourceFile = sourceUris[0].fsPath;

        const targetUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Workspace Folder to Merge into',
            canSelectFiles: false,
            canSelectFolders: true
        });
        if (!targetUris || targetUris.length === 0) { return; }
        const targetDir = targetUris[0].fsPath;

        const strategy = await vscode.window.showQuickPick(
            [
                { label: 'side_by_side', description: 'Append (Vault 1) suffix to conflicting filenames' },
                { label: 'overwrite', description: 'Replace any conflicting files' },
                { label: 'skip', description: 'Skip new conflicting files, keep existing' }
            ],
            { placeHolder: 'Select a file collision strategy' }
        );
        if (!strategy) { return; }

        const outputChannel = vscode.window.createOutputChannel('Vault Merger');
        outputChannel.show(true);
        outputChannel.appendLine('=== Vault Merger ===');
        outputChannel.appendLine(`Source file: ${sourceFile}`);
        outputChannel.appendLine(`Target workspace: ${targetDir}`);
        outputChannel.appendLine(`Collision strategy: ${strategy.label}`);
        outputChannel.appendLine('');

        try {
            const content = fs.readFileSync(sourceFile, 'utf8');
            let rules = DEFAULT_SPLIT_RULES;
            
            let configPath = path.join(path.dirname(sourceFile), 'config.yaml');
            if (!fs.existsSync(configPath) && vscode.workspace.workspaceFolders) {
                configPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'config.yaml');
            }
            if (fs.existsSync(configPath)) {
                try {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    rules = parseYamlSplitRules(configContent) || DEFAULT_SPLIT_RULES;
                } catch (e) { }
            }

            const splitter = new VaultSplitter();
            const segments = splitter.parse(content, rules);

            const merger = new VaultMerger();
            const writtenCount = await merger.merge(segments, targetDir, strategy.label as any);

            outputChannel.appendLine(`Processed ${segments.length} segments.`);
            outputChannel.appendLine(`Wrote/merged ${writtenCount} files into the target workspace.`);

            vscode.window.showInformationMessage(`Merge complete. Wrote ${writtenCount} files to ${targetDir}`);
        } catch (err: any) {
            outputChannel.appendLine(`Error: ${err.message}`);
            vscode.window.showErrorMessage(`Merge failed: ${err.message}`);
        }
    });

    // --- Fix Mermaid Diagrams command ---------------------------------------
    const fixMermaidCmd = vscode.commands.registerCommand('smart-exporter.fixMermaid', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder or workspace first.');
            return;
        }

        const selectedUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Fix Mermaid Diagrams',
            canSelectFiles: true,
            canSelectFolders: true,
            defaultUri: vscode.workspace.workspaceFolders[0].uri
        });
        if (!selectedUris || selectedUris.length === 0) { return; }

        const selectedPaths = selectedUris.map(uri => uri.fsPath);
        const outputChannel = vscode.window.createOutputChannel('Mermaid Fixer');
        outputChannel.show(true);
        outputChannel.appendLine('=== Mermaid Fixer ===');
        outputChannel.appendLine(`Scanning ${selectedPaths.length} path(s)...`);
        outputChannel.appendLine('');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fixing Mermaid diagrams...',
            cancellable: false
        }, async () => {
            const files = await fileScanner.scan(selectedPaths);
            const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));
            const fixer = new MermaidFixer();
            let modifiedCount = 0;

            for (const f of mdFiles) {
                try {
                    const content = fs.readFileSync(f, 'utf8');
                    const fixed = fixer.transform(content);
                    if (fixed !== content) {
                        fs.writeFileSync(f, fixed, 'utf8');
                        modifiedCount++;
                        const relPath = vscode.workspace.workspaceFolders ? path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, f) : f;
                        outputChannel.appendLine(`  Cleaned & Updated: ${relPath}`);
                    }
                } catch (e: any) {
                    outputChannel.appendLine(`  Failed to process ${f}: ${e.message}`);
                }
            }

            outputChannel.appendLine('');
            outputChannel.appendLine('=== Summary ===');
            outputChannel.appendLine(`Files scanned:   ${mdFiles.length}`);
            outputChannel.appendLine(`Files modified:  ${modifiedCount}`);

            vscode.window.showInformationMessage(`Mermaid formatting complete. Cleaned and saved ${modifiedCount} file(s).`);
        });
    });

    // --- Validate Quiz Files command -----------------------------------------
    const validateQuizzesCmd = vscode.commands.registerCommand('smart-exporter.validateQuizzes', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder or workspace first.');
            return;
        }

        const selectedUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Validate Quiz Files',
            canSelectFiles: true,
            canSelectFolders: true,
            defaultUri: vscode.workspace.workspaceFolders[0].uri
        });
        if (!selectedUris || selectedUris.length === 0) { return; }

        const selectedPaths = selectedUris.map(uri => uri.fsPath);
        const outputChannel = vscode.window.createOutputChannel('Semantic Quiz Validator');
        outputChannel.show(true);
        outputChannel.appendLine('=== Semantic Quiz Validator ===');
        outputChannel.appendLine(`Scanning ${selectedPaths.length} path(s)...`);
        outputChannel.appendLine('');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Validating quizzes...',
            cancellable: false
        }, async () => {
            const files = await fileScanner.scan(selectedPaths);
            const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));
            const validator = new QuizValidator();
            let passedCount = 0;
            let failedCount = 0;

            for (const f of mdFiles) {
                try {
                    const report = await validator.validateFile(f);
                    const relPath = vscode.workspace.workspaceFolders ? path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, f) : f;
                    if (report.isValid) {
                        outputChannel.appendLine(`[PASSED] ${relPath}`);
                        outputChannel.appendLine(`  Stats: TF: ${report.stats.true_false}, MC: ${report.stats.multiple_choice}, Match: ${report.stats.matching}`);
                        passedCount++;
                    } else {
                        outputChannel.appendLine(`[FAILED] ${relPath}`);
                        for (const [line, err] of report.errors) {
                            outputChannel.appendLine(`  - Line ~${line}: ERROR: ${err}`);
                        }
                        for (const [line, warn] of report.warnings) {
                            outputChannel.appendLine(`  - Line ~${line}: WARNING: ${warn}`);
                        }
                        failedCount++;
                    }
                } catch (e: any) {
                    outputChannel.appendLine(`[ERROR] Failed to validate ${f}: ${e.message}`);
                    failedCount++;
                }
            }

            outputChannel.appendLine('');
            outputChannel.appendLine('=== Validation Summary ===');
            outputChannel.appendLine(`Total files checked: ${mdFiles.length}`);
            outputChannel.appendLine(`Passed:              ${passedCount}`);
            outputChannel.appendLine(`Failed:              ${failedCount}`);

            if (failedCount > 0) {
                vscode.window.showErrorMessage(`Quiz validation failed: ${failedCount} files failed validation checks. See output panel for details.`);
            } else {
                vscode.window.showInformationMessage(`Quiz validation complete. All ${passedCount} files passed validation.`);
            }
        });
    });

    // --- Safe Renamer command -----------------------------------------------
    const renameFilesCmd = vscode.commands.registerCommand('smart-exporter.renameFiles', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder or workspace first.');
            return;
        }

        let configPath = '';
        if (vscode.workspace.workspaceFolders) {
            configPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'config.yaml');
        }

        let renameConfigs: Record<string, any> = {};
        if (fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                renameConfigs = parseYamlRenameConfigs(configContent) || {};
            } catch (e) { }
        }

        const options = [];
        for (const key of Object.keys(renameConfigs)) {
            options.push({
                label: `Pipeline: ${key}`,
                description: `Rename using configuration pipeline from config.yaml`,
                pipelineKey: key
            });
        }
        options.push({
            label: 'Custom Regex Rename',
            description: 'Define a custom search pattern and replacement format',
            pipelineKey: ''
        });

        const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select a renaming pipeline' });
        if (!selected) return;

        const outputChannel = vscode.window.createOutputChannel('Safe Renamer');
        outputChannel.show(true);
        outputChannel.appendLine('=== Safe Atomic Renamer ===');

        const renamer = new FileRenamer();

        if (selected.pipelineKey) {
            const pConf = renameConfigs[selected.pipelineKey];
            const targetDir = pConf.target_dir;
            const strategy = pConf.strategy || 'map';

            if (!fs.existsSync(targetDir)) {
                vscode.window.showErrorMessage(`Target directory does not exist: ${targetDir}`);
                return;
            }

            const filesInDir = fs.readdirSync(targetDir);
            let mapping: Record<string, string> = {};

            if (strategy === 'map') {
                mapping = renamer.generateMapMapping(filesInDir, pConf.mapping || {});
            } else if (strategy === 'regex_pattern') {
                mapping = renamer.generateRegexMapping(filesInDir, pConf.pattern || '', pConf.format || '');
            }

            if (Object.keys(mapping).length === 0) {
                vscode.window.showWarningMessage('No matching files found to rename.');
                return;
            }

            outputChannel.appendLine(`Pipeline: ${selected.pipelineKey}`);
            outputChannel.appendLine(`Target Directory: ${targetDir}`);
            outputChannel.appendLine(`Renaming ${Object.keys(mapping).length} file(s)...`);
            for (const [o, n] of Object.entries(mapping)) {
                outputChannel.appendLine(`  ${o} -> ${n}`);
            }

            try {
                await renamer.executeRename(targetDir, mapping);
                vscode.window.showInformationMessage(`Successfully renamed ${Object.keys(mapping).length} files.`);
            } catch (err: any) {
                outputChannel.appendLine(`Error: ${err.message}`);
                vscode.window.showErrorMessage(`Rename failed: ${err.message}`);
            }
        } else {
            const targetUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Select Directory to Rename Files in',
                canSelectFiles: false,
                canSelectFolders: true
            });
            if (!targetUris || targetUris.length === 0) return;
            const targetDir = targetUris[0].fsPath;

            const pattern = await vscode.window.showInputBox({
                prompt: 'Enter search regex pattern (e.g. ^Chapter (\\d+) - (.*)\\.md)',
                placeHolder: '^Chapter (\\d+) - (.*)\\.md'
            });
            if (!pattern) return;

            const format = await vscode.window.showInputBox({
                prompt: 'Enter replacement format (use {g1}, {g2} for matching groups, e.g. Ch {g1} - {g2}.md)',
                placeHolder: 'Ch {g1} - {g2}.md'
            });
            if (!format) return;

            const filesInDir = fs.readdirSync(targetDir);
            let mapping: Record<string, string> = {};
            try {
                mapping = renamer.generateRegexMapping(filesInDir, pattern, format);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Invalid pattern: ${e.message}`);
                return;
            }

            if (Object.keys(mapping).length === 0) {
                vscode.window.showWarningMessage('No matching files found to rename.');
                return;
            }

            outputChannel.appendLine(`Custom Regex Rename`);
            outputChannel.appendLine(`Target Directory: ${targetDir}`);
            outputChannel.appendLine(`Pattern: ${pattern}`);
            outputChannel.appendLine(`Format: ${format}`);
            outputChannel.appendLine(`Renaming ${Object.keys(mapping).length} file(s)...`);
            for (const [o, n] of Object.entries(mapping)) {
                outputChannel.appendLine(`  ${o} -> ${n}`);
            }

            try {
                await renamer.executeRename(targetDir, mapping);
                vscode.window.showInformationMessage(`Successfully renamed ${Object.keys(mapping).length} files.`);
            } catch (err: any) {
                outputChannel.appendLine(`Error: ${err.message}`);
                vscode.window.showErrorMessage(`Rename failed: ${err.message}`);
            }
        }
    });

    context.subscriptions.push(
        exportCmd,
        mergeCmd,
        purgeCmd,
        splitVaultCmd,
        mergeVaultCmd,
        fixMermaidCmd,
        validateQuizzesCmd,
        renameFilesCmd
    );
}

export function deactivate() {}