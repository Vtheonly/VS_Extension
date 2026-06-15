export function getWebviewContent(files: string[]): string {
    const tree: any = {};
    files.forEach(pathStr => {
        const parts = pathStr.split('/');
        let current = tree;
        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = index === parts.length - 1 ? null : {};
            }
            current = current[part];
        });
    });

    function generateTreeHtml(node: any, pathPrefix: string = ''): string {
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

            html += `<li>`;
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
                    ${generateTreeHtml(node[key], fullPath)}
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
            html += `</li>`;
        }
        html += '</ul>';
        return html;
    }

    const treeHtml = generateTreeHtml(tree);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Exporter Dashboard</title>
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
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        /* Tabs Navigation */
        .tab-bar {
            display: flex;
            background-color: var(--tab-inactive);
            border-bottom: 1px solid var(--border-color);
            user-select: none;
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
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }
        .tab-button:hover {
            background-color: var(--surface-hover);
            color: var(--text-bright);
        }
        .tab-button.active {
            background-color: var(--tab-active);
            color: var(--text-bright);
            border-bottom: 2px solid var(--accent);
            padding-bottom: 8px;
        }

        .tab-content-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        .tab-panel {
            display: none;
            flex-direction: column;
            gap: 16px;
            height: 100%;
        }
        .tab-panel.active { display: flex; }

        /* General Components */
        h2 { color: var(--text-bright); font-size: 18px; font-weight: 600; margin-bottom: 10px; }
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
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .form-group label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-bright);
        }
        
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

        .picker-row {
            display: flex;
            gap: 8px;
        }
        .picker-row input { flex: 1; }

        button {
            background-color: var(--surface);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 8px 14px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
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
            box-shadow: 0 2px 12px var(--accent-glow);
        }
        button.primary:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            box-shadow: none;
        }

        /* Split Rules Table */
        .rules-table, .preview-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
        }
        .rules-table th, .rules-table td, .preview-table th, .preview-table td {
            border: 1px solid var(--border-color);
            padding: 8px;
            text-align: left;
        }
        .rules-table th, .preview-table th {
            background-color: var(--bg-color);
            color: var(--text-bright);
        }

        /* Tree Styles */
        .tree-container {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background-color: var(--surface);
            padding: 12px;
            min-height: 250px;
        }
        ul.tree-list { list-style-type: none; padding-left: 20px; }
        .tree-container > ul.tree-list { padding-left: 0; }
        li { margin: 2px 0; }
        .tree-item {
            display: flex;
            align-items: center;
            padding: 4px 6px;
            cursor: pointer;
            border-radius: 4px;
            user-select: none;
        }
        .tree-item:hover { background-color: var(--surface-hover); }
        
        .toggle-icon {
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s ease;
        }
        .toggle-icon::before {
            content: '';
            border-style: solid;
            border-width: 4px 0 4px 6px;
            border-color: transparent transparent transparent var(--text-color);
            display: inline-block;
        }
        .toggle-icon.expanded { transform: rotate(90deg); }
        .spacer { width: 16px; }

        .folder-icon {
            width: 14px; height: 10px;
            background-color: var(--accent);
            border-radius: 1px 3px 2px 2px;
            position: relative;
            margin: 0 6px;
        }
        .folder-icon::before {
            content: ''; position: absolute; top: -3px; left: 0;
            width: 6px; height: 3px; background-color: var(--accent);
            border-radius: 1px 1px 0 0;
        }
        .file-icon {
            width: 10px; height: 13px;
            border: 1.5px solid var(--text-color);
            border-radius: 1px;
            position: relative;
            margin: 0 6px;
            opacity: 0.8;
        }

        /* Checkbox Customization */
        .checkbox-container {
            display: inline-flex;
            align-items: center;
            position: relative;
            cursor: pointer;
            margin: 0 4px;
        }
        .checkbox-container input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        .checkmark {
            height: 15px; width: 15px;
            background-color: #3c3c3c;
            border-radius: 3px;
            border: 1px solid #555;
            display: inline-block;
            position: relative;
        }
        .checkbox-container:hover input ~ .checkmark { background-color: #4c4c4c; }
        .checkbox-container input:checked ~ .checkmark { background-color: var(--accent); border-color: var(--accent); }
        .checkbox-container input:indeterminate ~ .checkmark { background-color: var(--accent); border-color: var(--accent); }
        .checkmark::after {
            content: ""; position: absolute; display: none;
            left: 4px; top: 1px; width: 3px; height: 7px;
            border: solid white; border-width: 0 2px 2px 0;
            transform: rotate(45deg);
        }
        .checkbox-container input:checked ~ .checkmark::after { display: block; }
        .checkbox-container input:indeterminate ~ .checkmark::after {
            display: block; left: 3px; top: 5px;
            width: 7px; height: 2px; background-color: white;
            border: none; transform: none;
        }

        /* Log console */
        .terminal-log {
            background-color: black;
            color: #00ff00;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            border-radius: 6px;
            padding: 12px;
            height: 150px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            white-space: pre-wrap;
        }

        /* Mode Selection Cards */
        .mode-cards {
            display: flex; gap: 8px;
        }
        .mode-card {
            flex: 1; border: 2px solid var(--border-color);
            background-color: var(--surface);
            border-radius: 6px; padding: 12px; cursor: pointer;
            text-align: center; font-size: 12px;
            font-weight: 600; color: var(--text-bright);
            transition: all 0.2s ease;
        }
        .mode-card:hover { border-color: var(--accent); }
        .mode-card.selected {
            border-color: var(--accent);
            background-color: var(--accent-glow);
        }

        /* Status Pills */
        .pill {
            display: inline-block; padding: 2px 8px; border-radius: 12px;
            font-size: 11px; font-weight: 600;
        }
        .pill.success { background-color: rgba(78, 201, 176, 0.2); color: var(--success); }
        .pill.warning { background-color: rgba(215, 186, 125, 0.2); color: var(--warning); }
        .pill.danger { background-color: rgba(244, 71, 71, 0.2); color: var(--danger); }
    </style>
</head>
<body>
    <div class="tab-bar">
        <button class="tab-button active" onclick="switchTab(event, 'export-tab')">Export Hub</button>
        <button class="tab-button" onclick="switchTab(event, 'vault-tab')">Vault Document Manager</button>
        <button class="tab-button" onclick="switchTab(event, 'tools-tab')">Markdown Formatting & Quiz Tools</button>
        <button class="tab-button" onclick="switchTab(event, 'rename-tab')">Safe Renamer</button>
        <button class="tab-button" onclick="switchTab(event, 'purge-tab')">Emoji Purger</button>
    </div>

    <div class="tab-content-container">
        <!-- 1. EXPORT HUB -->
        <div id="export-tab" class="tab-panel active">
            <h2>Classic & Merged Export</h2>
            <p style="margin-bottom: 12px;">Scan folder spaces, dynamically check files, choose layout structures, and package source code directories.</p>
            
            <div class="card" style="margin-bottom: 12px;">
                <div class="form-group">
                    <label>Workspace Target Folder Path</label>
                    <div class="picker-row">
                        <input type="text" id="exportWorkspacePath" placeholder="Click 'Browse' to choose a workspace path...">
                        <button onclick="pickFolder('exportWorkspacePath', true)">Browse</button>
                    </div>
                </div>
            </div>

            <div class="form-grid" id="exportControls" style="display:none; margin-bottom: 12px;">
                <div class="card" style="display: flex; flex-direction: column; gap:12px;">
                    <h3>Export Settings</h3>
                    <div class="form-group">
                        <label>Export Mode</label>
                        <div class="mode-cards">
                            <div class="mode-card selected" onclick="setExportMode('folder')" id="mode-folder">Per Folder</div>
                            <div class="mode-card" onclick="setExportMode('multi')" id="mode-multi">Multi-Folder</div>
                            <div class="mode-card" onclick="setExportMode('nuclear')" id="mode-nuclear">Nuclear</div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Max Split Limit File Size (KB)</label>
                        <input type="number" id="exportLimitKB" value="500" min="10">
                    </div>
                    <div style="display:flex; gap: 8px; margin-top:8px;">
                        <button class="primary" onclick="triggerClassicExport()" style="flex:1;">Classic Export</button>
                        <button class="primary" onclick="triggerMergeExport()" style="flex:1;">Merge & Export</button>
                    </div>
                </div>

                <div class="card" style="display:flex; flex-direction:column; gap:8px;">
                    <h3>Selection Controls</h3>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button onclick="expandAll()">Expand All</button>
                        <button onclick="collapseAll()">Collapse All</button>
                        <button onclick="selectAll(true)">Select All</button>
                        <button onclick="selectAll(false)">Deselect All</button>
                    </div>
                    <div style="margin-top:12px;">
                        <input type="text" id="treeSearch" placeholder="Filter files..." oninput="filterTree()">
                    </div>
                </div>
            </div>

            <div class="tree-container" id="treeContainer" style="display:none;">
                ${treeHtml}
            </div>
        </div>

        <!-- 2. VAULT MANAGER -->
        <div id="vault-tab" class="tab-panel">
            <h2>Vault Splitter & Merger</h2>
            <p style="margin-bottom: 12px;">Atomize complete Markdown files into segmented workspace hierarchies, or split and inject them with side-by-side collision safety strategies.</p>

            <div class="form-grid">
                <!-- Split Module -->
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Vault Splitter</h3>
                    <div class="form-group">
                        <label>Source Markdown Document</label>
                        <div class="picker-row">
                            <input type="text" id="splitSourceFile" placeholder="/path/to/source.md">
                            <button onclick="pickFile('splitSourceFile', {'Markdown':['md','markdown']})">Browse</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Target Workspace Folder</label>
                        <div class="picker-row">
                            <input type="text" id="splitTargetFolder" placeholder="/path/to/target_directory">
                            <button onclick="pickFolder('splitTargetFolder')">Browse</button>
                        </div>
                    </div>
                    <button class="primary" onclick="triggerSplitVault()">Execute Vault Split</button>
                </div>

                <!-- Merge Module -->
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Vault Merger</h3>
                    <div class="form-group">
                        <label>Source Markdown Document</label>
                        <div class="picker-row">
                            <input type="text" id="mergeSourceFile" placeholder="/path/to/source.md">
                            <button onclick="pickFile('mergeSourceFile', {'Markdown':['md','markdown']})">Browse</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Target Workspace Folder</label>
                        <div class="picker-row">
                            <input type="text" id="mergeTargetFolder" placeholder="/path/to/workspace">
                            <button onclick="pickFolder('mergeTargetFolder')">Browse</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>File Collision Policy</label>
                        <select id="mergeStrategy">
                            <option value="side_by_side">Side-by-Side (Append 'Vault 1')</option>
                            <option value="overwrite">Overwrite Target</option>
                            <option value="skip">Skip Conflicting</option>
                        </select>
                    </div>
                    <button class="primary" onclick="triggerMergeVault()">Execute Split & Merge</button>
                </div>
            </div>

            <div class="card">
                <h3>Splitting & Parsing Patterns</h3>
                <table class="rules-table">
                    <thead>
                        <tr><th>Level</th><th>Rule Key</th><th>Match Pattern</th><th>Target Folder Format</th><th>Target File Format</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Chapter</td><td><code>chapter</code></td><td><code>^#\\s+Chapter\\s+(\\d+)\\.\\s*(.*)</code></td><td>Chapter {g1}. {g2}</td><td>00 Introduction.md</td></tr>
                        <tr><td>Section</td><td><code>section</code></td><td><code>^##\\s+(\\d+)\\.\\s*(.*)</code></td><td>(Keep Parent)</td><td>{g1}. {g2}.md</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 3. TOOLS PANEL -->
        <div id="tools-tab" class="tab-panel">
            <h2>Markdown Formatting & Quiz Tools</h2>
            <p style="margin-bottom: 12px;">Repair broken Mermaid subgraph boundaries and validate question structural formats inside Markdown documents.</p>

            <div class="form-grid">
                <!-- Mermaid card -->
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Mermaid Fixer</h3>
                    <p>Clean non-standard quotes, parenthesis, subgraphs, and text boundaries.</p>
                    <div class="form-group">
                        <label>Target Workspace Space</label>
                        <div class="picker-row">
                            <input type="text" id="mermaidPath" placeholder="/path/to/directory_or_file">
                            <button onclick="pickFolder('mermaidPath')">Browse</button>
                        </div>
                    </div>
                    <button class="primary" onclick="triggerFixMermaid()">Run Mermaid Syntax Reformatter</button>
                </div>

                <!-- Quiz card -->
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <h3>Semantic Quiz Validator</h3>
                    <p>Check True/False, Multiple Choice, and Matching question blocks against strict formatting specifications.</p>
                    <div class="form-group">
                        <label>Target Workspace Space</label>
                        <div class="picker-row">
                            <input type="text" id="quizPath" placeholder="/path/to/directory_or_file">
                            <button onclick="pickFolder('quizPath')">Browse</button>
                        </div>
                    </div>
                    <button class="primary" onclick="triggerValidateQuizzes()">Validate Question Semantics</button>
                </div>
            </div>

            <!-- Quiz Results Reporting Area -->
            <div class="card" id="quizResultsCard" style="display:none; flex-direction:column; gap:8px;">
                <h3>Quiz Validator Run Report</h3>
                <div id="quizResultsContainer" style="overflow-x:auto; max-height:220px;"></div>
            </div>
        </div>

        <!-- 4. SAFE RENAMER -->
        <div id="rename-tab" class="tab-panel">
            <h2>Safe Atomic Renamer</h2>
            <p style="margin-bottom: 12px;">Safely preview pattern renames in bulk with absolute pre-execution safety tables to verify mapping output rules before writing to disk.</p>

            <div class="card" style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;">
                <div class="form-group">
                    <label>Target Directory Location</label>
                    <div class="picker-row">
                        <input type="text" id="renameDirectory" placeholder="/path/to/rename_target_dir">
                        <button onclick="pickFolder('renameDirectory')">Browse</button>
                    </div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Match Search Regex Pattern</label>
                        <input type="text" id="renamePattern" placeholder="e.g. ^Chapter (\\d+) - (.*)\\.md">
                    </div>
                    <div class="form-group">
                        <label>Replacement Format Expression</label>
                        <input type="text" id="renameFormat" placeholder="e.g. Ch {g1} - {g2}.md">
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="primary" onclick="triggerRenamePreview()">Generate Live Pre-Execution Preview</button>
                    <button class="primary" id="applyRenameBtn" disabled onclick="executeRename()" style="background: linear-gradient(135deg, var(--success), #2ebd59);">Apply Rename Actions</button>
                </div>
            </div>

            <div class="card" id="renamePreviewCard" style="display:none;">
                <h3>Live Rename Preview Mapping</h3>
                <div style="overflow-x:auto; max-height: 250px; margin-top:8px;">
                    <table class="preview-table">
                        <thead>
                            <tr><th>Original File Name</th><th>Evaluated New File Name</th></tr>
                        </thead>
                        <tbody id="renamePreviewBody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 5. EMOJI PURGER -->
        <div id="purge-tab" class="tab-panel">
            <h2>Emoji Purger</h2>
            <p style="margin-bottom: 12px;">Deep-clean all emoji characters and variation selectors from documents with standard console log reporting.</p>

            <div class="card" style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;">
                <div class="form-group">
                    <label>Target Directory or File to Deep-Clean</label>
                    <div class="picker-row">
                        <input type="text" id="purgeTarget" placeholder="/path/to/target_directory_or_file">
                        <button onclick="pickFolder('purgeTarget')">Browse</button>
                    </div>
                </div>
                <button class="primary" onclick="triggerPurge()" style="width:fit-content;">Execute Unicode Emoji Purge</button>
            </div>

            <div class="card" id="purgeResultsCard" style="display:none; flex-direction:column; gap:8px;">
                <h3>Purge Audit Report</h3>
                <div style="display:flex; gap:16px; font-size:13px; margin-bottom:8px;">
                    <div>Scanned: <span id="pScanned" style="font-weight:bold;">0</span></div>
                    <div>Modified: <span id="pModified" style="font-weight:bold;">0</span></div>
                    <div>Removed: <span id="pRemoved" style="font-weight:bold;">0</span></div>
                </div>
                <div id="purgeLogList" style="max-height:180px; overflow-y:auto; font-family:monospace; font-size:12px; background:var(--bg-color); padding:10px; border-radius:4px; display:flex; flex-direction:column; gap:4px;"></div>
            </div>
        </div>
    </div>

    <div class="card" style="margin: 0 20px 20px 20px;">
        <h3 style="font-size:12px; text-transform:uppercase; margin-bottom:6px;">Process Log Trace Terminal</h3>
        <div class="terminal-log" id="termLog">System initialized. Awaiting commands...</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let exportMode = 'folder';
        let currentScannedRoot = '';

        function switchTab(evt, tabId) {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            
            document.getElementById(tabId).classList.add('active');
            evt.currentTarget.classList.add('active');
        }

        // Parent-Child recursive directory expanding and collapsing
        document.querySelectorAll('.toggle-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleNode(icon);
            });
        });

        // Double click folder row triggers collapse
        document.querySelectorAll('.folder-item').forEach(item => {
            item.addEventListener('dblclick', (e) => {
                const icon = item.querySelector('.toggle-icon');
                if (icon) toggleNode(icon);
            });
        });

        function toggleNode(icon) {
            const li = icon.closest('li');
            const ul = li.querySelector('ul');
            if (ul) {
                if (ul.style.display === 'none') {
                    ul.style.display = 'block';
                    icon.classList.add('expanded');
                } else {
                    ul.style.display = 'none';
                    icon.classList.remove('expanded');
                }
            }
        }

        function expandAll() {
            document.querySelectorAll('.tree-list ul').forEach(ul => ul.style.display = 'block');
            document.querySelectorAll('.toggle-icon').forEach(icon => icon.classList.add('expanded'));
        }

        function collapseAll() {
            document.querySelectorAll('.tree-list ul').forEach(ul => ul.style.display = 'none');
            document.querySelectorAll('.toggle-icon').forEach(icon => icon.classList.remove('expanded'));
        }

        // Bubble check selections parent-child state synchronization
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const li = e.target.closest('li');

                const children = li.querySelectorAll('input[type="checkbox"]');
                children.forEach(child => {
                    child.checked = isChecked;
                    child.indeterminate = false;
                });

                updateParents(li);
                updateTreeStats();
            });
        });

        function updateParents(element) {
            const parentUl = element.closest('ul');
            if (!parentUl) return;
            const parentLi = parentUl.closest('li');
            if (!parentLi) return;

            const parentCheckbox = parentLi.querySelector(':scope > .tree-item > .checkbox-container > input');
            if (!parentCheckbox) return;

            const siblings = parentUl.querySelectorAll(':scope > li > .tree-item > .checkbox-container > input');
            let allChecked = true;
            let allUnchecked = true;

            siblings.forEach(sib => {
                if (!sib.checked) allChecked = false;
                if (sib.checked || sib.indeterminate) allUnchecked = false;
            });

            if (allChecked) {
                parentCheckbox.checked = true;
                parentCheckbox.indeterminate = false;
            } else if (allUnchecked) {
                parentCheckbox.checked = false;
                parentCheckbox.indeterminate = false;
            } else {
                parentCheckbox.checked = false;
                parentCheckbox.indeterminate = true;
            }

            updateParents(parentLi);
        }

        function selectAll(state) {
            document.querySelectorAll('.tree-container input[type="checkbox"]').forEach(cb => {
                cb.checked = state;
                cb.indeterminate = false;
            });
            updateTreeStats();
        }

        function updateTreeStats() {
            const checkedCount = document.querySelectorAll('.file-checkbox:checked').length;
            logToTerminal("Export selection updated: " + checkedCount + " file(s) checked.");
        }

        function filterTree() {
            const query = document.getElementById('treeSearch').value.toLowerCase().trim();
            document.querySelectorAll('.tree-item').forEach(item => {
                const label = item.querySelector('.label');
                if (!label) return;
                const text = label.textContent.toLowerCase();

                if (!query) {
                    item.classList.remove('hidden');
                    return;
                }

                if (text.includes(query)) {
                    item.classList.remove('hidden');
                    let parent = item.closest('ul');
                    while (parent) {
                        parent.style.display = 'block';
                        const parentItem = parent.closest('li');
                        if (parentItem) {
                            const pi = parentItem.querySelector(':scope > .tree-item');
                            if (pi) pi.classList.remove('hidden');
                        }
                        parent = parentItem ? parentItem.closest('ul') : null;
                    }
                } else if (item.classList.contains('file-item')) {
                    item.classList.add('hidden');
                }
            });
        }

        // Bridge picking channels
        function pickFolder(targetId, triggerScan = false) {
            vscode.postMessage({ command: 'selectFolder', targetId, triggerScan });
        }

        function pickFile(targetId, filters = null) {
            vscode.postMessage({ command: 'selectFile', targetId, filters });
        }

        function setExportMode(mode) {
            exportMode = mode;
            document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('mode-' + mode).classList.add('selected');
            logToTerminal("Switched export schema: " + mode);
        }

        function logToTerminal(msg) {
            const logBox = document.getElementById('termLog');
            const timeStr = new Date().toLocaleTimeString();
            logBox.textContent += "\\n[" + timeStr + "] " + msg;
            logBox.scrollTop = logBox.scrollHeight;
        }

        // Domain Action Triggers
        function triggerClassicExport() {
            const selectedFiles = [];
            document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
                selectedFiles.push(cb.value);
            });
            if (selectedFiles.length === 0) {
                logToTerminal("CRITICAL: Aborting classic export - no files selected.");
                return;
            }
            logToTerminal("Executing classic pipeline for " + selectedFiles.length + " checked items...");
            vscode.postMessage({
                command: 'classicExport',
                rootPath: currentScannedRoot,
                files: selectedFiles
            });
        }

        function triggerMergeExport() {
            const selectedFiles = [];
            document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
                selectedFiles.push(cb.value);
            });
            if (selectedFiles.length === 0) {
                logToTerminal("CRITICAL: Aborting merge export - no files selected.");
                return;
            }
            const limit = parseInt(document.getElementById('exportLimitKB').value) || 500;
            logToTerminal("Executing merge pipeline. Scheme: " + exportMode + ". Split limit: " + limit + "KB.");
            vscode.postMessage({
                command: 'mergeExport',
                rootPath: currentScannedRoot,
                files: selectedFiles,
                mode: exportMode,
                limitKB: limit
            });
        }

        function triggerSplitVault() {
            const src = document.getElementById('splitSourceFile').value;
            const dest = document.getElementById('splitTargetFolder').value;
            if (!src || !dest) {
                logToTerminal("ERROR: Split Vault target fields cannot be blank.");
                return;
            }
            logToTerminal("Triggering document splitter...");
            vscode.postMessage({ command: 'splitVault', src, dest });
        }

        function triggerMergeVault() {
            const src = document.getElementById('mergeSourceFile').value;
            const dest = document.getElementById('mergeTargetFolder').value;
            const strat = document.getElementById('mergeStrategy').value;
            if (!src || !dest) {
                logToTerminal("ERROR: Merge Vault target fields cannot be blank.");
                return;
            }
            logToTerminal("Triggering split & merge workspace pipeline. Policy: " + strat);
            vscode.postMessage({ command: 'mergeVault', src, dest, strategy: strat });
        }

        function triggerFixMermaid() {
            const pathValue = document.getElementById('mermaidPath').value;
            if (!pathValue) {
                logToTerminal("ERROR: Mermaid target path cannot be blank.");
                return;
            }
            logToTerminal("Reformatting Mermaid subgraphs: " + pathValue);
            vscode.postMessage({ command: 'fixMermaid', path: pathValue });
        }

        function triggerValidateQuizzes() {
            const pathValue = document.getElementById('quizPath').value;
            if (!pathValue) {
                logToTerminal("ERROR: Quiz target path cannot be blank.");
                return;
            }
            logToTerminal("Scanning and validating quizzes: " + pathValue);
            vscode.postMessage({ command: 'validateQuizzes', path: pathValue });
        }

        let renamingMapping = {};
        function triggerRenamePreview() {
            const targetDir = document.getElementById('renameDirectory').value;
            const pattern = document.getElementById('renamePattern').value;
            const format = document.getElementById('renameFormat').value;
            if (!targetDir || !pattern || !format) {
                logToTerminal("ERROR: All renamer fields must be populated.");
                return;
            }
            logToTerminal("Generating live renaming map...");
            vscode.postMessage({ command: 'previewRename', targetDir, pattern, format });
        }

        function executeRename() {
            const targetDir = document.getElementById('renameDirectory').value;
            logToTerminal("Applying atomic files renaming on disk...");
            vscode.postMessage({ command: 'executeRename', targetDir, mapping: renamingMapping });
        }

        function triggerPurge() {
            const target = document.getElementById('purgeTarget').value;
            if (!target) {
                logToTerminal("ERROR: Emoji purger target path cannot be blank.");
                return;
            }
            logToTerminal("Purging target: " + target);
            vscode.postMessage({ command: 'purgeEmojis', path: target });
        }

        // Message dispatcher channels
        window.addEventListener('message', event => {
            const msg = event.data;
            switch(msg.command) {
                case 'pathSelected':
                    document.getElementById(msg.targetId).value = msg.path;
                    logToTerminal("Location matched: " + msg.path);
                    if (msg.triggerScan) {
                        logToTerminal("Scanning directory tree structural bounds...");
                        vscode.postMessage({ command: 'scanDirectory', path: msg.path });
                    }
                    break;

                case 'scanCompleted':
                    currentScannedRoot = msg.rootPath;
                    const container = document.getElementById('treeContainer');
                    const controls = document.getElementById('exportControls');
                    container.innerHTML = msg.treeHtml;
                    container.style.display = 'block';
                    controls.style.display = 'grid';
                    logToTerminal("Directory scan found " + msg.count + " valid files.");
                    
                    // Bind listener models to dynamic nodes
                    container.querySelectorAll('.toggle-icon').forEach(icon => {
                        icon.addEventListener('click', (e) => { e.stopPropagation(); toggleNode(icon); });
                    });
                    container.querySelectorAll('.folder-item').forEach(item => {
                        item.addEventListener('dblclick', () => { toggleNode(item.querySelector('.toggle-icon')); });
                    });
                    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        cb.addEventListener('change', (e) => {
                            const isChecked = e.target.checked;
                            const li = e.target.closest('li');
                            li.querySelectorAll('input[type="checkbox"]').forEach(child => {
                                child.checked = isChecked;
                                child.indeterminate = false;
                            });
                            updateParents(li);
                            updateTreeStats();
                        });
                    });
                    break;

                case 'logMessage':
                    logToTerminal(msg.text);
                    break;

                case 'quizResults':
                    const resultsCard = document.getElementById('quizResultsCard');
                    const resultsCont = document.getElementById('quizResultsContainer');
                    resultsCard.style.display = 'flex';
                    
                    let html = '<table class="rules-table"><thead><tr><th>File</th><th>Format Security</th><th>TF</th><th>MC</th><th>Match</th><th>Issues Found</th></tr></thead><tbody>';
                    msg.reports.forEach(r => {
                        const statusPill = r.isValid ? '<span class="pill success">Passed</span>' : '<span class="pill danger">Failed</span>';
                        let issues = '';
                        r.errors.forEach(e => { issues += '<div>L' + e[0] + ' ERROR: ' + e[1] + '</div>'; });
                        r.warnings.forEach(w => { issues += '<div>L' + w[0] + ' WARN: ' + w[1] + '</div>'; });
                        
                        html += '<tr><td>' + r.filepath + '</td><td>' + statusPill + '</td><td>' + r.stats.true_false + '</td><td>' + r.stats.multiple_choice + '</td><td>' + r.stats.matching + '</td><td style="color:#d16969; font-size:11px;">' + (issues || 'None') + '</td></tr>';
                    });
                    html += '</tbody></table>';
                    resultsCont.innerHTML = html;
                    logToTerminal("Semantic validation scan complete.");
                    break;

                case 'renamePreviewData':
                    renamingMapping = msg.mapping;
                    const previewCard = document.getElementById('renamePreviewCard');
                    const previewBody = document.getElementById('renamePreviewBody');
                    const applyBtn = document.getElementById('applyRenameBtn');
                    
                    let tbodyHtml = '';
                    const entries = Object.entries(msg.mapping);
                    entries.forEach(([oldN, newN]) => {
                        tbodyHtml += '<tr><td>' + oldN + '</td><td style="color:var(--success);">' + newN + '</td></tr>';
                    });
                    
                    if (entries.length === 0) {
                        tbodyHtml = '<tr><td colspan="2">No files match specified regex rules.</td></tr>';
                        applyBtn.disabled = true;
                    } else {
                        applyBtn.disabled = false;
                    }
                    
                    previewBody.innerHTML = tbodyHtml;
                    previewCard.style.display = 'block';
                    logToTerminal("Computed " + entries.length + " rename possibilities.");
                    break;

                case 'emojiResults':
                    const purgeCard = document.getElementById('purgeResultsCard');
                    purgeCard.style.display = 'flex';
                    document.getElementById('pScanned').textContent = msg.summary.filesScanned;
                    document.getElementById('pModified').textContent = msg.summary.filesModified;
                    document.getElementById('pRemoved').textContent = msg.summary.totalEmojisRemoved;

                    let logHtml = '';
                    msg.summary.results.forEach(r => {
                        if (r.emojiCount > 0 && r.success) {
                            logHtml += '<div style="color:var(--success);">Cleaned ' + r.emojiCount + ' characters: ' + r.relPath + '</div>';
                        } else if (!r.success) {
                            logHtml += '<div style="color:var(--danger);">Error processing: ' + r.relPath + ' - ' + r.error + '</div>';
                        }
                    });
                    document.getElementById('purgeLogList').innerHTML = logHtml || '<div style="opacity:0.6">No emojis found in targeted files.</div>';
                    logToTerminal("Purge scanning complete.");
                    break;
            }
        });
    </script>
</body>
</html>`;
}