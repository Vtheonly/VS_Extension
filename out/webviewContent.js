"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
function getWebviewContent(webview, defaultWorkspacePath = '') {
    const cspSource = webview.cspSource;
    const safeDefaultPath = defaultWorkspacePath.replace(/\\/g, '\\\\');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Exporter & Codebase Purifier</title>
    <style>
        :root {
            --bg-color: #1e1e1e;
            --surface: #252526;
            --surface-hover: #2a2d2e;
            --text-color: #cccccc;
            --text-bright: #ffffff;
            --accent: #007acc;
            --accent-hover: #005f9e;
            --accent-glow: rgba(0, 122, 204, 0.25);
            --border-color: #3e3e42;
            --success: #4ec9b0;
            --warning: #d7ba7d;
            --danger: #f44747;
            --tab-active: #1e1e1e;
            --tab-inactive: #2d2d2d;
            --badge-bg: #333338;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        .tab-bar {
            display: flex;
            background-color: var(--tab-inactive);
            border-bottom: 1px solid var(--border-color);
            user-select: none;
            overflow-x: auto;
            flex-shrink: 0;
        }
        .tab-button {
            padding: 10px 16px;
            background: none;
            border: none;
            border-right: 1px solid var(--border-color);
            color: var(--text-color);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
        }
        .tab-button:hover { background-color: var(--surface-hover); color: var(--text-bright); }
        .tab-button.active {
            background-color: var(--tab-active);
            color: var(--text-bright);
            border-bottom: 2px solid var(--accent);
            padding-bottom: 8px;
        }

        .tab-content-container { flex: 1; overflow-y: auto; padding: 20px; }
        .tab-panel { display: none; flex-direction: column; gap: 16px; min-height: 100%; }
        .tab-panel.active { display: flex; }

        h2 { color: var(--text-bright); font-size: 17px; font-weight: 600; }
        h3 { color: var(--text-bright); font-size: 13px; font-weight: 600; }
        p { font-size: 13px; opacity: 0.85; line-height: 1.4; }
        
        .card {
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
        }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 12px; font-weight: 600; color: var(--text-bright); }
        
        input[type="text"], input[type="number"], select, textarea {
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-bright);
            padding: 8px 12px;
            font-size: 13px;
            outline: none;
            width: 100%;
        }
        input:focus, select:focus, textarea:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
        }

        .picker-row { display: flex; gap: 8px; }
        .picker-row input { flex: 1; }

        button {
            background-color: var(--surface);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 7px 14px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            user-select: none;
        }
        button:hover { background-color: var(--surface-hover); border-color: #555; }
        button.primary {
            background: linear-gradient(135deg, var(--accent), #0098ff);
            color: white;
            border: none;
            font-weight: 600;
        }
        button.primary:hover {
            background: linear-gradient(135deg, var(--accent-hover), #007acc);
        }

        /* Tree Styles */
        .tree-container {
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background-color: var(--surface);
            padding: 10px;
            overflow-y: auto;
            max-height: 480px;
        }
        .tree-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            margin-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }
        .tree-counter {
            font-size: 12px;
            font-weight: 600;
            color: var(--success);
        }
        .tree-node { list-style: none; margin: 0; padding: 0; }
        .tree-node ul {
            list-style: none;
            padding-left: 18px;
            margin-left: 6px;
            border-left: 1px dashed #3a3a3e;
        }
        .tree-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 13px;
            user-select: none;
            cursor: pointer;
        }
        .tree-row:hover { background-color: var(--surface-hover); }
        .chevron {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            font-size: 10px;
            color: #888;
            transition: transform 0.15s ease;
        }
        .chevron.collapsed { transform: rotate(-90deg); }
        .folder-icon { font-size: 13px; }
        .file-icon { font-size: 13px; opacity: 0.7; }
        .node-name {
            font-family: monospace;
            font-size: 12px;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .folder-badge {
            font-size: 10px;
            background: var(--badge-bg);
            padding: 1px 6px;
            border-radius: 10px;
            color: #aaa;
        }

        .mode-cards { display: flex; gap: 8px; }
        .mode-card {
            flex: 1; border: 2px solid var(--border-color);
            background-color: var(--surface);
            border-radius: 6px; padding: 8px; cursor: pointer;
            text-align: center; font-size: 12px;
            font-weight: 600; color: var(--text-bright);
        }
        .mode-card.selected {
            border-color: var(--accent);
            background-color: var(--accent-glow);
        }

        .toggle-box {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            cursor: pointer;
            padding: 4px 0;
        }
        .toggle-box input[type="checkbox"] {
            cursor: pointer;
            width: 16px;
            height: 16px;
        }

        .report-box {
            background: #111;
            border: 1px solid #333;
            border-radius: 6px;
            padding: 14px;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.5;
            color: #eee;
        }
    </style>
</head>
<body>
    <div class="tab-bar">
        <button class="tab-button active" onclick="switchTab(event, 'export-tab')">Export Hub &amp; Purifier</button>
        <button class="tab-button" onclick="switchTab(event, 'vault-tab')">Vault Document Manager</button>
        <button class="tab-button" onclick="switchTab(event, 'tools-tab')">Markdown &amp; Quizzes</button>
        <button class="tab-button" onclick="switchTab(event, 'rename-tab')">Safe Renamer</button>
        <button class="tab-button" onclick="switchTab(event, 'purge-tab')">Emoji Purger</button>
    </div>

    <div class="tab-content-container">
        <!-- UNIFIED EXPORT HUB + PURIFIER / SKELETONIZER PIPELINE -->
        <div id="export-tab" class="tab-panel active">
            <h2>Export Hub (Copy → Purify/Skeletonize → Export)</h2>
            <p>Select workspace files and optionally apply codebase purification &amp; skeletonization to the <strong>exported copy</strong> without modifying your workspace.</p>
            
            <!-- 1. Workspace Target Directory -->
            <div class="card">
                <div class="form-group">
                    <label>Workspace Target Folder</label>
                    <div class="picker-row">
                        <input type="text" id="exportWorkspacePath" placeholder="Choose project directory...">
                        <button onclick="pickFolder('exportWorkspacePath', true)">Browse &amp; Scan</button>
                    </div>
                </div>
            </div>

            <!-- 2. Selection State Profiles -->
            <div class="card" id="stateControls" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <h3>Selection State Profile (Persistent Memory)</h3>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <span style="font-size:12px;">Active Profile:</span>
                        <select id="selectionProfile" style="width:160px;" onchange="onProfileChange()">
                            <option value="default">default</option>
                        </select>
                        <input type="text" id="newProfileName" placeholder="New profile name..." style="width:150px;">
                        <button onclick="saveSelectionState()">Save Profile</button>
                    </div>
                </div>
            </div>

            <!-- 3. Export & Pipeline Settings Grid -->
            <div class="form-grid" id="exportControls" style="display:none;">
                <!-- Column 1: Pipeline Options (Purification & Skeletonization) -->
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Export Pipeline Processing</h3>
                    
                    <label class="toggle-box">
                        <input type="checkbox" id="optPurify" checked>
                        <span><strong>Purify Export</strong> (Exclude build dirs, bytecode, dumps)</span>
                    </label>

                    <div id="purifySubOptions" style="padding-left:24px; display:flex; flex-direction:column; gap:6px;">
                        <label class="toggle-box">
                            <input type="checkbox" id="optRemoveMarkdown" checked>
                            <span>Exclude non-source Markdown (Preserve specs like prices.md)</span>
                        </label>
                        <label class="toggle-box">
                            <input type="checkbox" id="optRemoveLockfiles" checked>
                            <span>Exclude package lockfiles</span>
                        </label>
                    </div>

                    <hr style="border:none; border-top:1px solid var(--border-color); margin:4px 0;">

                    <label class="toggle-box">
                        <input type="checkbox" id="optSkeletonize">
                        <span><strong>Skeletonize Export</strong> (Stub function bodies &amp; SQL procs)</span>
                    </label>

                    <div id="skelSubOptions" style="padding-left:24px; display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:12px;">Skeletonizer Level:</label>
                        <select id="skelMode">
                            <option value="light" selected>Light Mode (Functions &gt; 25 lines, default)</option>
                            <option value="medium">Medium Mode (Folders &gt; 200 total lines)</option>
                            <option value="full">Full Mode (All source functions &amp; methods)</option>
                        </select>
                    </div>

                    <div style="margin-top:6px;">
                        <button onclick="previewPipelineReduction()">Preview Reduction Stats</button>
                    </div>
                </div>

                <!-- Column 2: Export Formatting & Action Buttons -->
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Export Packaging Settings</h3>
                    
                    <div class="form-group">
                        <label>Export Scheme</label>
                        <div class="mode-cards">
                            <div class="mode-card selected" onclick="setExportMode('folder')" id="mode-folder">Per Folder</div>
                            <div class="mode-card" onclick="setExportMode('multi')" id="mode-multi">Multi-Folder</div>
                            <div class="mode-card" onclick="setExportMode('nuclear')" id="mode-nuclear">Nuclear</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Max Split Limit (KB)</label>
                        <input type="number" id="exportLimitKB" value="500" min="10">
                    </div>

                    <div style="display:flex; gap:8px; margin-top:auto;">
                        <button class="primary" onclick="triggerClassicExport()" style="flex:1;">Classic Export (.txt)</button>
                        <button class="primary" onclick="triggerMergeExport()" style="flex:1;">Merge &amp; Export Bundle</button>
                    </div>
                </div>
            </div>

            <!-- 4. Preview Reduction Report Card -->
            <div class="card" id="purifyReportCard" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3>Export Reduction Preview (Dry-Run on Export Copy)</h3>
                    <button onclick="document.getElementById('purifyReportCard').style.display='none'">Dismiss</button>
                </div>
                <div id="purifyReportContent" class="report-box"></div>
            </div>

            <!-- 5. Hierarchical Tree Browser -->
            <div class="tree-container" id="treeContainer" style="display:none;">
                <div class="tree-header">
                    <span id="treeStats" class="tree-counter">Selected: 0 / 0 files</span>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button onclick="selectAll(true)">Select All</button>
                        <button onclick="selectAll(false)">Deselect All</button>
                        <button onclick="toggleAllFolders(true)">Expand All</button>
                        <button onclick="toggleAllFolders(false)">Collapse All</button>
                    </div>
                </div>
                <input type="text" id="treeSearch" placeholder="Filter files in project tree..." oninput="filterTree()" style="margin-bottom:8px;">
                <div id="treeRoot"></div>
            </div>
        </div>

        <!-- 2. VAULT MANAGER -->
        <div id="vault-tab" class="tab-panel">
            <h2>Vault Splitter &amp; Merger</h2>
            <div class="form-grid">
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Vault Splitter</h3>
                    <div class="picker-row">
                        <input type="text" id="splitSourceFile" placeholder="Source .md...">
                        <button onclick="pickFile('splitSourceFile', {'Markdown':['md','markdown']})">Browse</button>
                    </div>
                    <div class="picker-row">
                        <input type="text" id="splitTargetFolder" placeholder="Target folder...">
                        <button onclick="pickFolder('splitTargetFolder')">Browse</button>
                    </div>
                    <button class="primary" onclick="triggerSplitVault()">Execute Vault Split</button>
                </div>

                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Vault Merger</h3>
                    <div class="picker-row">
                        <input type="text" id="mergeSourceFile" placeholder="Source .md...">
                        <button onclick="pickFile('mergeSourceFile', {'Markdown':['md','markdown']})">Browse</button>
                    </div>
                    <div class="picker-row">
                        <input type="text" id="mergeTargetFolder" placeholder="Target workspace...">
                        <button onclick="pickFolder('mergeTargetFolder')">Browse</button>
                    </div>
                    <select id="mergeStrategy">
                        <option value="side_by_side">Side-by-Side (Append 'Vault 1')</option>
                        <option value="overwrite">Overwrite Target</option>
                        <option value="skip">Skip Conflicting</option>
                    </select>
                    <button class="primary" onclick="triggerMergeVault()">Execute Split &amp; Merge</button>
                </div>
            </div>
        </div>

        <!-- 3. TOOLS -->
        <div id="tools-tab" class="tab-panel">
            <h2>Markdown Tools &amp; Quiz Validation</h2>
            <div class="form-grid">
                <div class="card">
                    <h3>Mermaid Fixer</h3>
                    <div class="picker-row" style="margin: 8px 0;">
                        <input type="text" id="mermaidPath" placeholder="Path...">
                        <button onclick="pickFolder('mermaidPath')">Browse</button>
                    </div>
                    <button class="primary" onclick="triggerFixMermaid()">Reformat Mermaid Syntax</button>
                </div>
                <div class="card">
                    <h3>Quiz Validator</h3>
                    <div class="picker-row" style="margin: 8px 0;">
                        <input type="text" id="quizPath" placeholder="Path...">
                        <button onclick="pickFolder('quizPath')">Browse</button>
                    </div>
                    <button class="primary" onclick="triggerValidateQuizzes()">Validate Questions</button>
                </div>
            </div>
            <div class="card" id="quizResultsCard" style="display:none; margin-top:12px;">
                <div id="quizResultsContainer"></div>
            </div>
        </div>

        <!-- 4. SAFE RENAMER -->
        <div id="rename-tab" class="tab-panel">
            <h2>Safe Atomic Renamer</h2>
            <div class="card">
                <div class="picker-row">
                    <input type="text" id="renameDirectory" placeholder="Target folder...">
                    <button onclick="pickFolder('renameDirectory')">Browse</button>
                </div>
                <div class="form-grid" style="margin: 8px 0;">
                    <input type="text" id="renamePattern" placeholder="Regex: ^Chapter (\\\\d+) - (.*)\\\\.md">
                    <input type="text" id="renameFormat" placeholder="Format: Ch {g1} - {g2}.md">
                </div>
                <button class="primary" onclick="triggerRenamePreview()">Generate Live Preview</button>
            </div>
        </div>

        <!-- 5. EMOJI PURGER -->
        <div id="purge-tab" class="tab-panel">
            <h2>Unicode Emoji Purger</h2>
            <div class="card">
                <div class="picker-row">
                    <input type="text" id="purgeTarget" placeholder="Target path...">
                    <button onclick="pickFolder('purgeTarget')">Browse</button>
                </div>
                <button class="primary" onclick="triggerPurge()" style="margin-top:8px;">Execute Emoji Purge</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let exportMode = 'folder';
        let currentScannedRoot = '';
        let currentFiles = [];
        let selectionMap = {};

        // Automatic initial workspace bootstrap
        const initialPath = "${safeDefaultPath}";
        if (initialPath) {
            document.getElementById('exportWorkspacePath').value = initialPath;
            vscode.postMessage({ command: 'initWorkspace', path: initialPath });
        }

        function switchTab(evt, tabId) {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            evt.currentTarget.classList.add('active');
        }

        function pickFolder(targetId, triggerScan = false) {
            vscode.postMessage({ command: 'selectFolder', targetId, triggerScan });
        }
        function pickFile(targetId, filters = null) {
            vscode.postMessage({ command: 'selectFile', targetId, filters });
        }

        function setExportMode(mode) {
            exportMode = mode;
            document.querySelectorAll('.mode-cards .mode-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('mode-' + mode).classList.add('selected');
        }

        function updateStats() {
            const total = currentFiles.length;
            const selected = Object.values(selectionMap).filter(Boolean).length;
            document.getElementById('treeStats').textContent = 'Selected: ' + selected + ' / ' + total + ' files';
        }

        function selectAll(checked) {
            currentFiles.forEach(f => {
                selectionMap[f] = checked;
            });
            document.querySelectorAll('.file-cb').forEach(cb => cb.checked = checked);
            document.querySelectorAll('.folder-cb').forEach(cb => {
                cb.checked = checked;
                cb.indeterminate = false;
            });
            updateStats();
            autoSaveState();
        }

        function toggleAllFolders(expand) {
            document.querySelectorAll('.chevron').forEach(ch => {
                ch.classList.toggle('collapsed', !expand);
            });
            document.querySelectorAll('.folder-group').forEach(ul => {
                ul.style.display = expand ? 'block' : 'none';
            });
        }

        function toggleFolder(folderId) {
            const ul = document.getElementById(folderId);
            const ch = document.getElementById('ch-' + folderId);
            if (!ul || !ch) return;
            const isClosed = ul.style.display === 'none';
            ul.style.display = isClosed ? 'block' : 'none';
            ch.classList.toggle('collapsed', !isClosed);
        }

        function onFolderCheck(folderCb, folderPath) {
            const checked = folderCb.checked;
            folderCb.indeterminate = false;
            const prefix = folderPath === '' ? '' : folderPath + '/';
            currentFiles.forEach(f => {
                if (folderPath === '' || f.startsWith(prefix)) {
                    selectionMap[f] = checked;
                }
            });
            const container = folderCb.closest('li');
            if (container) {
                container.querySelectorAll('.file-cb, .folder-cb').forEach(cb => {
                    cb.checked = checked;
                    cb.indeterminate = false;
                });
            }
            updateFolderCheckStates();
            updateStats();
            autoSaveState();
        }

        function onFileCheck(fileCb, filePath) {
            selectionMap[filePath] = fileCb.checked;
            updateFolderCheckStates();
            updateStats();
            autoSaveState();
        }

        function updateFolderCheckStates() {
            document.querySelectorAll('.folder-cb').forEach(fcb => {
                const dirPath = fcb.getAttribute('data-folder-path') || '';
                const prefix = dirPath === '' ? '' : dirPath + '/';
                const childFiles = currentFiles.filter(f => dirPath === '' || f.startsWith(prefix));
                if (childFiles.length === 0) return;

                const checkedCount = childFiles.filter(f => selectionMap[f]).length;
                if (checkedCount === childFiles.length) {
                    fcb.checked = true;
                    fcb.indeterminate = false;
                } else if (checkedCount === 0) {
                    fcb.checked = false;
                    fcb.indeterminate = false;
                } else {
                    fcb.checked = false;
                    fcb.indeterminate = true;
                }
            });
        }

        function autoSaveState() {
            if (!currentScannedRoot) return;
            const profile = document.getElementById('selectionProfile').value || 'default';
            vscode.postMessage({
                command: 'saveSelectionState',
                rootPath: currentScannedRoot,
                selectionMap,
                profile
            });
        }

        function saveSelectionState() {
            const input = document.getElementById('newProfileName');
            const custom = input.value.trim();
            const profile = custom || document.getElementById('selectionProfile').value || 'default';
            if (custom) {
                input.value = '';
            }
            vscode.postMessage({
                command: 'saveSelectionState',
                rootPath: currentScannedRoot,
                selectionMap,
                profile
            });
        }

        function escHtml(str) {
            return str
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function loadSelectionState() {
            const profile = document.getElementById('selectionProfile').value || 'default';
            vscode.postMessage({
                command: 'loadSelectionState',
                rootPath: currentScannedRoot,
                profile
            });
        }

        function onProfileChange() {
            loadSelectionState();
        }

        function buildTree(files) {
            const root = { name: '', path: '', isDir: true, dirs: {}, files: [] };
            files.forEach(f => {
                const parts = f.split('/');
                let cur = root;
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    const dirPath = parts.slice(0, i + 1).join('/');
                    if (!cur.dirs[part]) {
                        cur.dirs[part] = { name: part, path: dirPath, isDir: true, dirs: {}, files: [] };
                    }
                    cur = cur.dirs[part];
                }
                cur.files.push(f);
            });
            return root;
        }

        let folderIdCounter = 0;

        function renderTreeNode(node) {
            let html = '<ul class="tree-node">';
            
            Object.keys(node.dirs).sort().forEach(dName => {
                const dir = node.dirs[dName];
                const fid = 'folder-' + (folderIdCounter++);
                const totalFilesInDir = currentFiles.filter(f => f.startsWith(dir.path + '/')).length;

                html += \`<li>
                    <div class="tree-row">
                        <span class="chevron" id="ch-\${fid}" onclick="toggleFolder('\${fid}')">▼</span>
                        <input type="checkbox" class="folder-cb" data-folder-path="\${escHtml(dir.path)}" onchange="onFolderCheck(this, this.getAttribute('data-folder-path'))">
                        <span class="folder-icon" onclick="toggleFolder('\${fid}')">📁</span>
                        <span class="node-name" onclick="toggleFolder('\${fid}')">\${escHtml(dName)}</span>
                        <span class="folder-badge">\${totalFilesInDir}</span>
                    </div>
                    <div id="\${fid}" class="folder-group">
                        \${renderTreeNode(dir)}
                    </div>
                </li>\`;
            });

            node.files.sort().forEach(f => {
                const filename = f.split('/').pop();
                const isChecked = selectionMap[f] !== undefined ? selectionMap[f] : true;
                selectionMap[f] = isChecked;

                html += \`<li class="file-leaf" data-path="\${escHtml(f.toLowerCase())}">
                    <div class="tree-row" style="padding-left: 20px;">
                        <input type="checkbox" class="file-cb" value="\${escHtml(f)}" \${isChecked ? 'checked' : ''} onchange="onFileCheck(this, this.value)">
                        <span class="file-icon">📄</span>
                        <span class="node-name">\${escHtml(filename)}</span>
                    </div>
                </li>\`;
            });

            html += '</ul>';
            return html;
        }

        function renderTree(files, savedSelection) {
            folderIdCounter = 0;
            selectionMap = {};
            files.forEach(f => {
                selectionMap[f] = savedSelection && savedSelection[f] !== undefined ? savedSelection[f] : true;
            });

            const treeModel = buildTree(files);
            const rootContainer = document.getElementById('treeRoot');
            rootContainer.innerHTML = renderTreeNode(treeModel);

            document.getElementById('treeContainer').style.display = 'block';
            document.getElementById('exportControls').style.display = 'grid';
            document.getElementById('stateControls').style.display = 'block';

            updateFolderCheckStates();
            updateStats();
        }

        function filterTree() {
            const q = document.getElementById('treeSearch').value.toLowerCase().trim();
            document.querySelectorAll('.file-leaf').forEach(el => {
                const p = el.getAttribute('data-path') || '';
                const match = !q || p.includes(q);
                el.style.display = match ? 'block' : 'none';
            });
            if (q) toggleAllFolders(true);
        }

        function getTransformOptions() {
            return {
                purify: document.getElementById('optPurify').checked,
                removeMarkdown: document.getElementById('optRemoveMarkdown').checked,
                removeLockfiles: document.getElementById('optRemoveLockfiles').checked,
                skeletonize: document.getElementById('optSkeletonize').checked,
                skeletonMode: document.getElementById('optSkeletonize').checked ? document.getElementById('skelMode').value : 'none'
            };
        }

        function triggerClassicExport() {
            const selected = Object.keys(selectionMap).filter(k => selectionMap[k]);
            if (selected.length === 0) return;
            vscode.postMessage({
                command: 'classicExport',
                rootPath: currentScannedRoot,
                files: selected,
                transformOpts: getTransformOptions()
            });
        }

        function triggerMergeExport() {
            const selected = Object.keys(selectionMap).filter(k => selectionMap[k]);
            if (selected.length === 0) return;
            const limit = parseInt(document.getElementById('exportLimitKB').value) || 500;
            vscode.postMessage({
                command: 'mergeExport',
                rootPath: currentScannedRoot,
                files: selected,
                mode: exportMode,
                limitKB: limit,
                transformOpts: getTransformOptions()
            });
        }

        function previewPipelineReduction() {
            const selected = Object.keys(selectionMap).filter(k => selectionMap[k]);
            if (selected.length === 0) return;
            vscode.postMessage({
                command: 'previewPipelineReduction',
                rootPath: currentScannedRoot,
                files: selected,
                transformOpts: getTransformOptions()
            });
        }

        function triggerSplitVault() {
            const src = document.getElementById('splitSourceFile').value;
            const dest = document.getElementById('splitTargetFolder').value;
            vscode.postMessage({ command: 'splitVault', src, dest });
        }

        function triggerMergeVault() {
            const src = document.getElementById('mergeSourceFile').value;
            const dest = document.getElementById('mergeTargetFolder').value;
            const strategy = document.getElementById('mergeStrategy').value;
            vscode.postMessage({ command: 'mergeVault', src, dest, strategy });
        }

        function triggerFixMermaid() {
            vscode.postMessage({ command: 'fixMermaid', path: document.getElementById('mermaidPath').value });
        }
        function triggerValidateQuizzes() {
            vscode.postMessage({ command: 'validateQuizzes', path: document.getElementById('quizPath').value });
        }
        function triggerRenamePreview() {
            vscode.postMessage({
                command: 'previewRename',
                targetDir: document.getElementById('renameDirectory').value,
                pattern: document.getElementById('renamePattern').value,
                format: document.getElementById('renameFormat').value
            });
        }
        function triggerPurge() {
            vscode.postMessage({ command: 'purgeEmojis', path: document.getElementById('purgeTarget').value });
        }

        window.addEventListener('message', event => {
            const msg = event.data;
            switch(msg.command) {
                case 'pathSelected':
                    document.getElementById(msg.targetId).value = msg.path;
                    if (msg.triggerScan) {
                        vscode.postMessage({ command: 'scanDirectory', path: msg.path });
                    }
                    break;

                case 'scanCompleted':
                    currentScannedRoot = msg.rootPath;
                    currentFiles = msg.files;
                    renderTree(msg.files, msg.savedSelection);
                    
                    const pSelect = document.getElementById('selectionProfile');
                    pSelect.innerHTML = '';
                    (msg.profiles || ['default']).forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p; opt.textContent = p;
                        pSelect.appendChild(opt);
                    });
                    if (msg.activeProfile) {
                        pSelect.value = msg.activeProfile;
                    }
                    break;

                case 'profilesUpdated': {
                    const pSel = document.getElementById('selectionProfile');
                    pSel.innerHTML = '';
                    (msg.profiles || ['default']).forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p; opt.textContent = p;
                        pSel.appendChild(opt);
                    });
                    if (msg.activeProfile) {
                        pSel.value = msg.activeProfile;
                    }
                    break;
                }

                case 'selectionLoaded':
                    if (msg.files) {
                        currentFiles = msg.files;
                    }
                    renderTree(currentFiles, msg.selection);
                    break;

                case 'selectionSynced': {
                    if (msg.rootPath !== currentScannedRoot) break;
                    const currentProf = document.getElementById('selectionProfile').value || 'default';
                    if (msg.profile && msg.profile !== currentProf) break;

                    const synced = msg.selection || {};
                    const currentSet = new Set(currentFiles);
                    let addedNew = false;

                    for (const [rel, val] of Object.entries(synced)) {
                        if (val === true && !currentSet.has(rel)) {
                            currentFiles.push(rel);
                            currentSet.add(rel);
                            addedNew = true;
                        }
                    }

                    if (addedNew) {
                        renderTree(currentFiles, synced);
                    } else {
                        currentFiles.forEach(f => {
                            selectionMap[f] = synced[f] !== undefined ? synced[f] : true;
                        });
                        document.querySelectorAll('.file-cb').forEach(cb => {
                            const f = cb.value;
                            if (selectionMap[f] !== undefined) {
                                cb.checked = selectionMap[f];
                            }
                        });
                        updateFolderCheckStates();
                        updateStats();
                    }
                    break;
                }

                case 'pipelinePreviewReport':
                    const card = document.getElementById('purifyReportCard');
                    const pre = document.getElementById('purifyReportContent');
                    card.style.display = 'block';
                    
                    const r = msg.report;
                    let text = "Export Reduction Analysis (Copy Preview)\\n";
                    text += "----------------------------------------\\n";
                    text += "Skeleton Mode: " + r.mode.toUpperCase() + "\\n\\n";
                    text += "Lines:\\n";
                    text += "  • Before:        " + r.totalLinesBefore.toLocaleString() + " lines\\n";
                    text += "  • After:         " + r.totalLinesAfter.toLocaleString() + " lines\\n";
                    text += "  • Removed:       " + r.linesRemoved.toLocaleString() + " lines\\n";
                    text += "  • Reduction:     " + r.reductionPercentage + "%\\n\\n";
                    text += "Files:\\n";
                    text += "  • Files scanned:       " + r.filesScanned + "\\n";
                    text += "  • Files skeletonized:  " + r.filesSkeletonized + "\\n";
                    text += "  • Files unchanged:     " + r.filesUnchanged + "\\n";
                    text += "  • Files excluded:      " + r.filesRemoved + "\\n";
                    text += "  • Markdown excluded:   " + r.markdownRemoved + "\\n\\n";
                    text += "Breakdown by File Type:\\n";
                    for (const [k, v] of Object.entries(r.typeStats)) {
                        const red = v.before > 0 ? (((v.before - v.after) / v.before) * 100).toFixed(1) : "0.0";
                        text += "  • " + k.padEnd(26) + " | " + String(v.files).padStart(3) + " files | " + String(v.before).padStart(6) + " → " + String(v.after).padStart(6) + " lines (-" + red + "%)\\n";
                    }
                    pre.textContent = text;
                    break;
            }
        });
    </script>
</body>
</html>`;
}
//# sourceMappingURL=webviewContent.js.map