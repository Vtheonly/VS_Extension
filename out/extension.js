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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const FileScanner_1 = require("./services/FileScanner");
const ClassicExportPipeline_1 = require("./services/ClassicExportPipeline");
const MergeExportPipeline_1 = require("./services/MergeExportPipeline");
const emojiPurgeService_1 = require("./emojiPurgeService");
const webviewContent_1 = require("./webviewContent");
const SelectionStateManager_1 = require("./services/SelectionStateManager");
const PurificationService_1 = require("./services/PurificationService");
const SkeletonizerService_1 = require("./services/SkeletonizerService");
// Service models
const VaultSplitter_1 = require("./services/VaultSplitter");
const VaultMerger_1 = require("./services/VaultMerger");
const MermaidFixer_1 = require("./services/MermaidFixer");
const QuizValidator_1 = require("./services/QuizValidator");
const FileRenamer_1 = require("./services/FileRenamer");
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
const ACTIVE_PROFILE_KEY = 'smartExporter.activeProfiles';
const fileScanner = new FileScanner_1.FileScanner(ALLOWED_EXTENSIONS, ALLOWED_FILENAMES, EXCLUDE_DIRS);
const classicExporter = new ClassicExportPipeline_1.ClassicExportPipeline();
const mergeExporter = new MergeExportPipeline_1.MergeExportPipeline();
const stateManager = new SelectionStateManager_1.SelectionStateManager();
let currentPanel = undefined;
let activeDashboardRoot = undefined;
let activeDashboardProfile = 'default';
let statusBarItem = undefined;
function isSupportedUriScheme(uri) {
    return uri.scheme === 'file' || uri.scheme === 'vscode-remote';
}
function isPathInside(parentPath, childPath) {
    const rel = path.relative(path.resolve(parentPath), path.resolve(childPath));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
function resolveRootForUri(uri) {
    const fsPath = uri.fsPath;
    if (currentPanel && activeDashboardRoot && isPathInside(activeDashboardRoot, fsPath)) {
        return activeDashboardRoot;
    }
    const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (wsFolder) {
        return wsFolder.uri.fsPath;
    }
    const nearestRoot = stateManager.findNearestStateDirRoot(fsPath);
    if (nearestRoot) {
        return nearestRoot;
    }
    try {
        if (fs.existsSync(fsPath) && fs.statSync(fsPath).isDirectory()) {
            return fsPath;
        }
    }
    catch {
        // fallback to parent directory
    }
    return path.dirname(fsPath);
}
function getActiveProfile(context, rootPath) {
    const resolved = path.resolve(rootPath);
    if (currentPanel && activeDashboardRoot && path.resolve(activeDashboardRoot) === resolved) {
        return activeDashboardProfile;
    }
    const map = context.workspaceState.get(ACTIVE_PROFILE_KEY, {});
    return map[resolved] || 'default';
}
async function setActiveProfile(context, rootPath, profile) {
    const resolved = path.resolve(rootPath);
    if (currentPanel && activeDashboardRoot && path.resolve(activeDashboardRoot) === resolved) {
        activeDashboardProfile = profile;
    }
    const map = context.workspaceState.get(ACTIVE_PROFILE_KEY, {});
    const updated = { ...map, [resolved]: profile };
    await context.workspaceState.update(ACTIVE_PROFILE_KEY, updated);
}
async function scanWorkspaceFiles(wsPath, savedSelection) {
    const files = await fileScanner.scan([wsPath]);
    const relativeFiles = files.map(f => path.relative(wsPath, f).replace(/\\/g, '/'));
    const relSet = new Set(relativeFiles);
    if (savedSelection) {
        for (const [rel, isIncluded] of Object.entries(savedSelection)) {
            if (isIncluded && !relSet.has(rel)) {
                const abs = path.join(wsPath, rel);
                try {
                    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
                        relativeFiles.push(rel);
                        relSet.add(rel);
                    }
                }
                catch {
                    // ignore missing/inaccessible files
                }
            }
        }
    }
    return relativeFiles;
}
async function updateStatusBar(context) {
    if (!statusBarItem)
        return;
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSupportedUriScheme(editor.document.uri)) {
        statusBarItem.hide();
        await vscode.commands.executeCommand('setContext', 'smartExporter.currentFileIncluded', false);
        return;
    }
    const uri = editor.document.uri;
    const rootPath = resolveRootForUri(uri);
    const relPath = stateManager.toRelativePath(rootPath, uri.fsPath);
    if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
        statusBarItem.hide();
        return;
    }
    const profile = getActiveProfile(context, rootPath);
    const defaultIncluded = fileScanner.isDefaultIncluded(uri.fsPath, rootPath);
    const included = await stateManager.isFileIncluded(rootPath, relPath, defaultIncluded, profile);
    await vscode.commands.executeCommand('setContext', 'smartExporter.currentFileIncluded', included);
    if (included) {
        statusBarItem.text = '$(check) Export: On';
        statusBarItem.tooltip = `Smart Exporter [${profile}]: "${relPath}" is INCLUDED in export list. Click to exclude.`;
    }
    else {
        statusBarItem.text = '$(circle-slash) Export: Off';
        statusBarItem.tooltip = `Smart Exporter [${profile}]: "${relPath}" is EXCLUDED from export list. Click to include.`;
    }
    statusBarItem.show();
}
function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'smart-exporter.toggleExportFile';
    context.subscriptions.push(statusBarItem);
    const stateWatcher = vscode.workspace.createFileSystemWatcher('**/.smartexport/*.json');
    context.subscriptions.push(stateWatcher, stateWatcher.onDidChange(() => { void updateStatusBar(context); }), stateWatcher.onDidCreate(() => { void updateStatusBar(context); }), stateWatcher.onDidDelete(() => { void updateStatusBar(context); }), vscode.window.onDidChangeActiveTextEditor(() => {
        void updateStatusBar(context);
    }), vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.fsPath.includes(`${path.sep}.smartexport${path.sep}`)) {
            void updateStatusBar(context);
        }
    }));
    void updateStatusBar(context);
    const toggleExportFileCmd = vscode.commands.registerCommand('smart-exporter.toggleExportFile', async (resourceUri, selectedUris) => {
        let targetUris = [];
        if (selectedUris && selectedUris.length > 0) {
            targetUris = selectedUris.filter(isSupportedUriScheme);
        }
        else if (resourceUri && isSupportedUriScheme(resourceUri)) {
            targetUris = [resourceUri];
        }
        else if (vscode.window.activeTextEditor &&
            isSupportedUriScheme(vscode.window.activeTextEditor.document.uri)) {
            targetUris = [vscode.window.activeTextEditor.document.uri];
        }
        if (targetUris.length === 0) {
            const wsFolder = vscode.workspace.workspaceFolders?.[0];
            const fallbackRoot = activeDashboardRoot || wsFolder?.uri.fsPath;
            if (!fallbackRoot || !fs.existsSync(fallbackRoot)) {
                vscode.window.showInformationMessage('Open a file or workspace folder to toggle files in the Smart Export list.');
                return;
            }
            const profile = getActiveProfile(context, fallbackRoot);
            const saved = await stateManager.loadSelection(fallbackRoot, profile);
            const relFiles = await scanWorkspaceFiles(fallbackRoot, saved);
            if (relFiles.length === 0) {
                vscode.window.showInformationMessage('No files found in workspace to toggle.');
                return;
            }
            relFiles.sort();
            const picks = relFiles.map(rel => {
                const included = saved && saved[rel] !== undefined ? saved[rel] : true;
                return {
                    label: `${included ? '$(check)' : '$(circle-slash)'} ${rel}`,
                    description: included ? 'Included — select to exclude' : 'Excluded — select to include',
                    relPath: rel
                };
            });
            const chosen = await vscode.window.showQuickPick(picks, {
                placeHolder: `Toggle file in Smart Export list [${profile}]`,
                matchOnDescription: true
            });
            if (!chosen)
                return;
            const pickedUri = wsFolder && path.resolve(wsFolder.uri.fsPath) === path.resolve(fallbackRoot)
                ? vscode.Uri.joinPath(wsFolder.uri, ...chosen.relPath.split('/'))
                : vscode.Uri.file(path.join(fallbackRoot, chosen.relPath));
            targetUris = [pickedUri];
        }
        const grouped = new Map();
        for (const uri of targetUris) {
            const rootPath = resolveRootForUri(uri);
            if (!grouped.has(rootPath)) {
                grouped.set(rootPath, []);
            }
            const items = grouped.get(rootPath);
            let stat;
            try {
                stat = await fs.promises.stat(uri.fsPath);
            }
            catch {
                continue;
            }
            if (stat.isDirectory()) {
                const profile = getActiveProfile(context, rootPath);
                const saved = await stateManager.loadSelection(rootPath, profile);
                const scanned = await fileScanner.scan([uri.fsPath]);
                const dirRel = stateManager.toRelativePath(rootPath, uri.fsPath);
                const prefix = dirRel === '' ? '' : `${dirRel}/`;
                const seen = new Set(items.map(i => i.relPath));
                for (const abs of scanned) {
                    const rel = stateManager.toRelativePath(rootPath, abs);
                    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel) && !seen.has(rel)) {
                        seen.add(rel);
                        items.push({ relPath: rel, defaultIncluded: true });
                    }
                }
                if (saved) {
                    for (const [rel, val] of Object.entries(saved)) {
                        if (val === true && !seen.has(rel) && (dirRel === '' || rel.startsWith(prefix))) {
                            const abs = path.join(rootPath, rel);
                            try {
                                if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
                                    seen.add(rel);
                                    items.push({ relPath: rel, defaultIncluded: false });
                                }
                            }
                            catch {
                                // ignore inaccessible paths
                            }
                        }
                    }
                }
            }
            else if (stat.isFile()) {
                const relPath = stateManager.toRelativePath(rootPath, uri.fsPath);
                if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
                    continue;
                }
                const defaultIncluded = fileScanner.isDefaultIncluded(uri.fsPath, rootPath);
                items.push({ relPath, defaultIncluded });
            }
        }
        for (const [rootPath, rawItems] of grouped.entries()) {
            const deduped = new Map();
            for (const item of rawItems) {
                if (!deduped.has(item.relPath)) {
                    deduped.set(item.relPath, item);
                }
            }
            const items = Array.from(deduped.values());
            if (items.length === 0) {
                vscode.window.showInformationMessage('No toggleable files found in selection.');
                continue;
            }
            const profile = getActiveProfile(context, rootPath);
            const result = await stateManager.toggleBatch(rootPath, items, profile);
            if (currentPanel &&
                activeDashboardRoot &&
                path.resolve(activeDashboardRoot) === path.resolve(rootPath)) {
                currentPanel.webview.postMessage({
                    command: 'selectionSynced',
                    rootPath,
                    profile,
                    selection: result.files
                });
            }
            const actionLabel = result.included ? 'Included' : 'Excluded';
            const prep = result.included ? 'in' : 'from';
            if (items.length === 1) {
                vscode.window.showInformationMessage(`Smart Exporter [${profile}]: ${actionLabel} "${items[0].relPath}" ${prep} export list.`);
            }
            else {
                vscode.window.showInformationMessage(`Smart Exporter [${profile}]: ${actionLabel} ${result.count} files ${prep} export list.`);
            }
        }
        await updateStatusBar(context);
    });
    const selectProfileCmd = vscode.commands.registerCommand('smart-exporter.selectProfile', async () => {
        const editor = vscode.window.activeTextEditor;
        const rootPath = editor && isSupportedUriScheme(editor.document.uri)
            ? resolveRootForUri(editor.document.uri)
            : (activeDashboardRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
        if (!rootPath) {
            vscode.window.showInformationMessage('Open a workspace folder or file first.');
            return;
        }
        const profiles = await stateManager.listProfiles(rootPath);
        const current = getActiveProfile(context, rootPath);
        const items = profiles.map(p => ({
            label: p,
            description: p === current ? '(active)' : undefined
        }));
        items.push({
            label: '$(add) Create new profile...',
            description: 'Create and switch to a new selection profile'
        });
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: `Select active Smart Exporter profile for ${path.basename(rootPath)}`
        });
        if (!picked)
            return;
        let chosenProfile = picked.label;
        if (picked.label.startsWith('$(add)')) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter new Smart Exporter profile name',
                placeHolder: 'e.g., backend, minimal, review'
            });
            if (!input || !input.trim())
                return;
            chosenProfile = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const existing = (await stateManager.loadSelection(rootPath, chosenProfile)) || {};
            await stateManager.saveSelection(rootPath, existing, chosenProfile);
        }
        await setActiveProfile(context, rootPath, chosenProfile);
        await updateStatusBar(context);
        if (currentPanel &&
            activeDashboardRoot &&
            path.resolve(activeDashboardRoot) === path.resolve(rootPath)) {
            const saved = await stateManager.loadSelection(rootPath, chosenProfile);
            const allProfiles = await stateManager.listProfiles(rootPath);
            const scannedFiles = await scanWorkspaceFiles(rootPath, saved);
            currentPanel.webview.postMessage({
                command: 'scanCompleted',
                files: scannedFiles,
                savedSelection: saved || {},
                profiles: allProfiles,
                activeProfile: chosenProfile,
                count: scannedFiles.length,
                rootPath
            });
        }
        vscode.window.showInformationMessage(`Smart Exporter active profile switched to "${chosenProfile}".`);
    });
    const openDashboardCmd = vscode.commands.registerCommand('smart-exporter.exportFiles', async () => {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (currentPanel) {
            currentPanel.reveal(column);
            return;
        }
        currentPanel = vscode.window.createWebviewPanel('smartExporterDashboard', 'Smart Exporter Dashboard', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [context.extensionUri]
        });
        const initialWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        currentPanel.webview.html = (0, webviewContent_1.getWebviewContent)(currentPanel.webview, initialWorkspace);
        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
            activeDashboardRoot = undefined;
            activeDashboardProfile = 'default';
        }, null, context.subscriptions);
        currentPanel.webview.onDidReceiveMessage(async (message) => {
            const panel = currentPanel;
            if (!panel)
                return;
            switch (message.command) {
                case 'initWorkspace': {
                    const wsPath = message.path || initialWorkspace;
                    if (wsPath && fs.existsSync(wsPath)) {
                        try {
                            const profiles = await stateManager.listProfiles(wsPath);
                            const savedProfile = getActiveProfile(context, wsPath);
                            const activeProf = profiles.includes(savedProfile) ? savedProfile : 'default';
                            activeDashboardRoot = wsPath;
                            activeDashboardProfile = activeProf;
                            const savedSelection = await stateManager.loadSelection(wsPath, activeProf);
                            const relativeFiles = await scanWorkspaceFiles(wsPath, savedSelection);
                            panel.webview.postMessage({
                                command: 'scanCompleted',
                                files: relativeFiles,
                                savedSelection: savedSelection || {},
                                profiles,
                                activeProfile: activeProf,
                                count: relativeFiles.length,
                                rootPath: wsPath
                            });
                            await updateStatusBar(context);
                        }
                        catch { }
                    }
                    break;
                }
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
                        const profiles = await stateManager.listProfiles(message.path);
                        const requestedProf = message.profile || getActiveProfile(context, message.path);
                        const activeProf = profiles.includes(requestedProf) ? requestedProf : 'default';
                        activeDashboardRoot = message.path;
                        activeDashboardProfile = activeProf;
                        await setActiveProfile(context, message.path, activeProf);
                        const savedSelection = await stateManager.loadSelection(message.path, activeProf);
                        const relativeFiles = await scanWorkspaceFiles(message.path, savedSelection);
                        panel.webview.postMessage({
                            command: 'scanCompleted',
                            files: relativeFiles,
                            savedSelection: savedSelection || {},
                            profiles,
                            activeProfile: activeProf,
                            count: relativeFiles.length,
                            rootPath: message.path
                        });
                        await updateStatusBar(context);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Scan failed: ${err.message}`);
                    }
                    break;
                }
                case 'saveSelectionState': {
                    try {
                        const profile = message.profile || 'default';
                        await stateManager.saveSelection(message.rootPath, message.selectionMap, profile);
                        activeDashboardRoot = message.rootPath;
                        activeDashboardProfile = profile;
                        await setActiveProfile(context, message.rootPath, profile);
                        const profiles = await stateManager.listProfiles(message.rootPath);
                        panel.webview.postMessage({
                            command: 'profilesUpdated',
                            profiles,
                            activeProfile: profile
                        });
                        await updateStatusBar(context);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Failed to save selection: ${err.message}`);
                    }
                    break;
                }
                case 'loadSelectionState': {
                    try {
                        const profile = message.profile || 'default';
                        activeDashboardRoot = message.rootPath;
                        activeDashboardProfile = profile;
                        await setActiveProfile(context, message.rootPath, profile);
                        const selection = await stateManager.loadSelection(message.rootPath, profile);
                        const relativeFiles = await scanWorkspaceFiles(message.rootPath, selection);
                        panel.webview.postMessage({
                            command: 'selectionLoaded',
                            files: relativeFiles,
                            selection: selection || {}
                        });
                        await updateStatusBar(context);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Failed to load selection: ${err.message}`);
                    }
                    break;
                }
                case 'previewPipelineReduction': {
                    try {
                        const rootPath = message.rootPath;
                        let relFiles = message.files;
                        const tOpts = message.transformOpts;
                        let excludedCount = 0;
                        let excludedLines = 0;
                        let mdExcluded = 0;
                        if (tOpts.purify) {
                            const filterRes = PurificationService_1.PurificationService.filterFilesForExport(relFiles, {
                                removeMarkdown: tOpts.removeMarkdown,
                                removeLockfiles: tOpts.removeLockfiles,
                                removeDumps: true,
                            });
                            for (const rem of filterRes.removed) {
                                try {
                                    const src = await fs.promises.readFile(path.join(rootPath, rem), 'utf8');
                                    excludedLines += SkeletonizerService_1.SkeletonizerService.countLines(src);
                                    if (rem.endsWith('.md'))
                                        mdExcluded++;
                                }
                                catch { }
                            }
                            excludedCount = filterRes.removed.length;
                            relFiles = filterRes.kept;
                        }
                        const metrics = [];
                        const folderLineCounts = new Map();
                        for (const rel of relFiles) {
                            try {
                                const src = await fs.promises.readFile(path.join(rootPath, rel), 'utf8');
                                const folder = path.dirname(rel);
                                folderLineCounts.set(folder, (folderLineCounts.get(folder) || 0) + SkeletonizerService_1.SkeletonizerService.countLines(src));
                            }
                            catch { }
                        }
                        for (const rel of relFiles) {
                            try {
                                const src = await fs.promises.readFile(path.join(rootPath, rel), 'utf8');
                                const linesBefore = SkeletonizerService_1.SkeletonizerService.countLines(src);
                                const bytesBefore = Buffer.byteLength(src, 'utf8');
                                const ext = path.extname(rel);
                                const folder = path.dirname(rel);
                                let transformed = src;
                                if (tOpts.skeletonize && tOpts.skeletonMode !== 'none') {
                                    const shouldSkel = tOpts.skeletonMode !== 'medium' || (folderLineCounts.get(folder) || 0) > 200;
                                    if (shouldSkel) {
                                        transformed = SkeletonizerService_1.SkeletonizerService.skeletonizeCode(src, ext, tOpts.skeletonMode);
                                    }
                                }
                                const linesAfter = SkeletonizerService_1.SkeletonizerService.countLines(transformed);
                                const bytesAfter = Buffer.byteLength(transformed, 'utf8');
                                metrics.push({
                                    relPath: rel,
                                    linesBefore,
                                    linesAfter,
                                    bytesBefore,
                                    bytesAfter,
                                    modified: transformed !== src
                                });
                            }
                            catch { }
                        }
                        const report = SkeletonizerService_1.SkeletonizerService.generateReport(tOpts.skeletonMode, metrics, excludedCount, excludedLines, mdExcluded);
                        panel.webview.postMessage({ command: 'pipelinePreviewReport', report });
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Preview calculation failed: ${err.message}`);
                    }
                    break;
                }
                case 'classicExport': {
                    const abs = message.files.map(p => path.join(message.rootPath, p));
                    await classicExporter.execute(abs, message.rootPath, message.transformOpts);
                    break;
                }
                case 'mergeExport': {
                    const abs = message.files.map(p => path.join(message.rootPath, p));
                    await mergeExporter.execute(abs, message.rootPath, message.mode, message.limitKB, message.transformOpts);
                    break;
                }
                case 'splitVault': {
                    try {
                        const content = fs.readFileSync(message.src, 'utf8');
                        const rules = [
                            { type: 'chapter', pattern: '^#\\s+Chapter\\s+(\\d+)\\.\\s*(.*)', folder_format: 'Chapter {g1}. {g2}', file_format: '00 Introduction.md' },
                            { type: 'section', pattern: '^##\\s+(\\d+)\\.\\s*(.*)', folder_format: '', file_format: '{g1}. {g2}.md' }
                        ];
                        const splitter = new VaultSplitter_1.VaultSplitter();
                        const segments = splitter.parse(content, rules);
                        for (const segment of segments) {
                            const destFolder = path.join(message.dest, segment.folder);
                            if (!fs.existsSync(destFolder))
                                fs.mkdirSync(destFolder, { recursive: true });
                            fs.writeFileSync(path.join(destFolder, segment.filename), segment.content, 'utf8');
                        }
                        vscode.window.showInformationMessage(`Vault Split completed: ${segments.length} files.`);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Vault Split error: ${err.message}`);
                    }
                    break;
                }
                case 'mergeVault': {
                    try {
                        const content = fs.readFileSync(message.src, 'utf8');
                        const rules = [
                            { type: 'chapter', pattern: '^#\\s+Chapter\\s+(\\d+)\\.\\s*(.*)', folder_format: 'Chapter {g1}. {g2}', file_format: '00 Introduction.md' },
                            { type: 'section', pattern: '^##\\s+(\\d+)\\.\\s*(.*)', folder_format: '', file_format: '{g1}. {g2}.md' }
                        ];
                        const splitter = new VaultSplitter_1.VaultSplitter();
                        const segments = splitter.parse(content, rules);
                        const merger = new VaultMerger_1.VaultMerger();
                        const written = await merger.merge(segments, message.dest, message.strategy);
                        vscode.window.showInformationMessage(`Merge Vault completed: ${written} files written.`);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Vault Merge error: ${err.message}`);
                    }
                    break;
                }
                case 'fixMermaid': {
                    try {
                        const files = await fileScanner.scan([message.path]);
                        const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));
                        const fixer = new MermaidFixer_1.MermaidFixer();
                        let count = 0;
                        for (const f of mdFiles) {
                            const content = fs.readFileSync(f, 'utf8');
                            const transformed = fixer.transform(content);
                            if (transformed !== content) {
                                fs.writeFileSync(f, transformed, 'utf8');
                                count++;
                            }
                        }
                        vscode.window.showInformationMessage(`Fixed ${count} Mermaid diagrams.`);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Mermaid Fixer error: ${err.message}`);
                    }
                    break;
                }
                case 'validateQuizzes': {
                    try {
                        const files = await fileScanner.scan([message.path]);
                        const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));
                        const validator = new QuizValidator_1.QuizValidator();
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
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Quiz Validator error: ${err.message}`);
                    }
                    break;
                }
                case 'previewRename': {
                    try {
                        const filesInDir = fs.readdirSync(message.targetDir);
                        const renamer = new FileRenamer_1.FileRenamer();
                        const mapping = renamer.generateRegexMapping(filesInDir, message.pattern, message.format);
                        panel.webview.postMessage({ command: 'renamePreviewData', mapping });
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Rename Preview error: ${err.message}`);
                    }
                    break;
                }
                case 'executeRename': {
                    try {
                        const renamer = new FileRenamer_1.FileRenamer();
                        await renamer.executeRename(message.targetDir, message.mapping);
                        vscode.window.showInformationMessage(`Renamed ${Object.keys(message.mapping).length} files.`);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Rename error: ${err.message}`);
                    }
                    break;
                }
                case 'purgeEmojis': {
                    try {
                        const summary = await emojiPurgeService_1.EmojiPurgeService.purgePaths([message.path]);
                        panel.webview.postMessage({ command: 'emojiResults', summary });
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`Emoji purge error: ${err.message}`);
                    }
                    break;
                }
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(toggleExportFileCmd, selectProfileCmd, openDashboardCmd);
}
function deactivate() {
    if (currentPanel) {
        currentPanel.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
}
//# sourceMappingURL=extension.js.map