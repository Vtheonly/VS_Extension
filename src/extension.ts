import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileScanner } from './services/FileScanner';
import { ClassicExportPipeline } from './services/ClassicExportPipeline';
import { MergeExportPipeline } from './services/MergeExportPipeline';
import { EmojiPurgeService } from './emojiPurgeService';
import { getWebviewContent } from './webviewContent';

// Service models
import { VaultSplitter } from './services/VaultSplitter';
import { VaultMerger } from './services/VaultMerger';
import { MermaidFixer } from './services/MermaidFixer';
import { QuizValidator } from './services/QuizValidator';
import { FileRenamer } from './services/FileRenamer';
import { SplitRule } from './core/interfaces';

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

const fileScanner = new FileScanner(ALLOWED_EXTENSIONS, ALLOWED_FILENAMES, EXCLUDE_DIRS);
const classicExporter = new ClassicExportPipeline();
const mergeExporter = new MergeExportPipeline();

export function activate(context: vscode.ExtensionContext) {

    const openDashboardCmd = vscode.commands.registerCommand('smart-exporter.exportFiles', async () => {
        const panel = vscode.window.createWebviewPanel(
            'smartExporterDashboard',
            'Smart Exporter Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'out'))]
            }
        );

        panel.webview.html = getWebviewContent([]);

        // Unified Message routing pipeline
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'selectFolder': {
                    const uris = await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        canSelectFiles: false,
                        canSelectFolders: true,
                        openLabel: 'Select Directory'
                    });
                    if (uris && uris[0]) {
                        panel.webview.postMessage({
                            command: 'pathSelected',
                            targetId: message.targetId,
                            path: uris[0].fsPath,
                            triggerScan: message.triggerScan
                        });
                    }
                    break;
                }

                case 'selectFile': {
                    const uris = await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        canSelectFiles: true,
                        canSelectFolders: false,
                        openLabel: 'Select Document',
                        filters: message.filters
                    });
                    if (uris && uris[0]) {
                        panel.webview.postMessage({
                            command: 'pathSelected',
                            targetId: message.targetId,
                            path: uris[0].fsPath,
                            triggerScan: false
                        });
                    }
                    break;
                }

                case 'scanDirectory': {
                    try {
                        const files = await fileScanner.scan([message.path]);
                        const relativeFiles = files.map(f => path.relative(message.path, f).split(path.sep).join('/'));
                        
                        // Internal HTML generator bound to Webview DOM
                        const tree = {};
                        relativeFiles.forEach(pathStr => {
                            const parts = pathStr.split('/');
                            let current: any = tree;
                            parts.forEach((part, index) => {
                                if (!current[part]) {
                                    current[part] = index === parts.length - 1 ? null : {};
                                }
                                current = current[part];
                            });
                        });

                        function buildTreeHtml(node: any, pathPrefix = ''): string {
                            let html = '<ul class="tree-list">';
                            const keys = Object.keys(node).sort((a, b) => {
                                const aIsFolder = node[a] !== null;
                                const bIsFolder = node[b] !== null;
                                if (aIsFolder && !bIsFolder) return -1;
                                if (!aIsFolder && bIsFolder) return 1;
                                return a.localeCompare(b);
                            });

                            for (const key of keys) {
                                const fullPath = pathPrefix ? `${pathPrefix}/${key}` : key;
                                const isFolder = node[key] !== null;
                                html += '<li>';
                                if (isFolder) {
                                    html += `
                                        <div class="tree-item folder-item" data-path="${fullPath}">
                                            <span class="toggle-icon expanded"></span>
                                            <label class="checkbox-container">
                                                <input type="checkbox" class="folder-checkbox" data-path="${fullPath}" checked>
                                                <span class="checkmark"></span>
                                            </label>
                                            <span class="folder-icon"></span>
                                            <span class="label">${key}</span>
                                        </div>
                                        ${buildTreeHtml(node[key], fullPath)}
                                    `;
                                } else {
                                    html += `
                                        <div class="tree-item file-item" data-path="${fullPath}">
                                            <span class="spacer"></span>
                                            <label class="checkbox-container">
                                                <input type="checkbox" class="file-checkbox" value="${fullPath}" checked>
                                                <span class="checkmark"></span>
                                            </label>
                                            <span class="file-icon"></span>
                                            <span class="label">${key}</span>
                                        </div>
                                    `;
                                }
                                html += '</li>';
                            }
                            html += '</ul>';
                            return html;
                        }

                        const innerTreeHtml = buildTreeHtml(tree);
                        panel.webview.postMessage({
                            command: 'scanCompleted',
                            treeHtml: innerTreeHtml,
                            count: relativeFiles.length,
                            rootPath: message.path
                        });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Scan failed: ${err.message}` });
                    }
                    break;
                }

                case 'classicExport': {
                    const abs = (message.files as string[]).map(p => path.join(message.rootPath, p));
                    await classicExporter.execute(abs, message.rootPath);
                    panel.webview.postMessage({ command: 'logMessage', text: 'Classic export executed.' });
                    break;
                }

                case 'mergeExport': {
                    const abs = (message.files as string[]).map(p => path.join(message.rootPath, p));
                    await mergeExporter.execute(abs, message.rootPath, message.mode, message.limitKB);
                    panel.webview.postMessage({ command: 'logMessage', text: 'Merge & Export executed.' });
                    break;
                }

                case 'splitVault': {
                    try {
                        const content = fs.readFileSync(message.src, 'utf8');
                        const rules: SplitRule[] = [
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
                        const splitter = new VaultSplitter();
                        const segments = splitter.parse(content, rules);

                        for (const segment of segments) {
                            const destFolder = path.join(message.dest, segment.folder);
                            if (!fs.existsSync(destFolder)) {
                                fs.mkdirSync(destFolder, { recursive: true });
                            }
                            fs.writeFileSync(path.join(destFolder, segment.filename), segment.content, 'utf8');
                        }
                        panel.webview.postMessage({ command: 'logMessage', text: `Vault Split finished. Generated ${segments.length} segments inside ${message.dest}` });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Split Vault failed: ${err.message}` });
                    }
                    break;
                }

                case 'mergeVault': {
                    try {
                        const content = fs.readFileSync(message.src, 'utf8');
                        const rules: SplitRule[] = [
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
                        const splitter = new VaultSplitter();
                        const segments = splitter.parse(content, rules);

                        const merger = new VaultMerger();
                        const written = await merger.merge(segments, message.dest, message.strategy);
                        panel.webview.postMessage({ command: 'logMessage', text: `Split & Merge finished. Actioned ${written} files inside ${message.dest}` });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Merge Vault failed: ${err.message}` });
                    }
                    break;
                }

                case 'fixMermaid': {
                    try {
                        const files = await fileScanner.scan([message.path]);
                        const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));
                        const fixer = new MermaidFixer();
                        let count = 0;

                        for (const f of mdFiles) {
                            const content = fs.readFileSync(f, 'utf8');
                            const transformed = fixer.transform(content);
                            if (transformed !== content) {
                                fs.writeFileSync(f, transformed, 'utf8');
                                count++;
                            }
                        }
                        panel.webview.postMessage({ command: 'logMessage', text: `Fixed ${count} Mermaid diagrams in scanned area.` });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Mermaid fixer failed: ${err.message}` });
                    }
                    break;
                }

                case 'validateQuizzes': {
                    try {
                        const files = await fileScanner.scan([message.path]);
                        const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));
                        const validator = new QuizValidator();
                        const reports = [];

                        for (const f of mdFiles) {
                            const report = await validator.validateFile(f);
                            reports.push({
                                filepath: path.basename(f),
                                isValid: report.isValid,
                                errors: report.errors,
                                warnings: report.warnings,
                                stats: report.stats
                            });
                        }
                        panel.webview.postMessage({ command: 'quizResults', reports });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Quiz validation failed: ${err.message}` });
                    }
                    break;
                }

                case 'previewRename': {
                    try {
                        const filesInDir = fs.readdirSync(message.targetDir);
                        const renamer = new FileRenamer();
                        const mapping = renamer.generateRegexMapping(filesInDir, message.pattern, message.format);
                        panel.webview.postMessage({ command: 'renamePreviewData', mapping });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Mapping generation failed: ${err.message}` });
                    }
                    break;
                }

                case 'executeRename': {
                    try {
                        const renamer = new FileRenamer();
                        await renamer.executeRename(message.targetDir, message.mapping);
                        panel.webview.postMessage({ command: 'logMessage', text: `Applied atomic renaming on ${Object.keys(message.mapping).length} files.` });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Atomic rename run failed: ${err.message}` });
                    }
                    break;
                }

                case 'purgeEmojis': {
                    try {
                        const summary = await EmojiPurgeService.purgePaths([message.path]);
                        panel.webview.postMessage({ command: 'emojiResults', summary });
                    } catch (err: any) {
                        panel.webview.postMessage({ command: 'logMessage', text: `ERROR: Purge run failed: ${err.message}` });
                    }
                    break;
                }
            }
        }, undefined, context.subscriptions);
    });

    // Mount standard shortcuts pointing directly to our Unified Dashboard
    const mergeCmd = vscode.commands.registerCommand('smart-exporter.mergeExport', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });
    const purgeCmd = vscode.commands.registerCommand('smart-exporter.purgeEmojis', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });
    const splitVaultCmd = vscode.commands.registerCommand('smart-exporter.splitVault', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });
    const mergeVaultCmd = vscode.commands.registerCommand('smart-exporter.mergeVault', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });
    const fixMermaidCmd = vscode.commands.registerCommand('smart-exporter.fixMermaid', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });
    const validateQuizzesCmd = vscode.commands.registerCommand('smart-exporter.validateQuizzes', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });
    const renameFilesCmd = vscode.commands.registerCommand('smart-exporter.renameFiles', () => {
        vscode.commands.executeCommand('smart-exporter.exportFiles');
    });

    context.subscriptions.push(
        openDashboardCmd,
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