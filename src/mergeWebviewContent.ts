export function getMergeWebviewContent(files: string[]): string {
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
                    <div class="tree-item folder-item">
                        <span class="toggle-icon expanded">v</span>
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
                    <div class="tree-item file-item">
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
    <title>Smart Exporter - Merge & Export</title>
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
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        /* -- Header ----------------------------------------- */
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }
        .header h2 {
            color: var(--text-bright);
            font-weight: 600;
            font-size: 18px;
        }
        .header .badge {
            background: var(--accent);
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 600;
        }

        /* -- Settings Panel --------------------------------- */
        .settings-panel {
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .settings-panel h3 {
            color: var(--text-bright);
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 14px;
            opacity: 0.8;
            display: flex;
            align-items: center;
        }

        .settings-row {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
            align-items: flex-start;
        }
        .setting-group {
            flex: 1;
            min-width: 200px;
        }
        .setting-group label {
            display: block;
            font-size: 12px;
            color: var(--text-color);
            margin-bottom: 8px;
            font-weight: 500;
        }

        /* Radio mode cards */
        .mode-options {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .mode-card {
            flex: 1;
            min-width: 120px;
            background: var(--bg-color);
            border: 2px solid var(--border-color);
            border-radius: 6px;
            padding: 10px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
        }
        .mode-card:hover {
            border-color: var(--accent);
            background: rgba(0,122,204,0.08);
        }
        .mode-card.selected {
            border-color: var(--accent);
            background: var(--accent-glow);
            box-shadow: 0 0 12px var(--accent-glow);
        }
        .mode-card input[type="radio"] { display: none; }
        .mode-card .mode-icon {
            margin-bottom: 6px;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 28px;
        }
        .mode-card .mode-icon svg {
            width: 24px;
            height: 24px;
            fill: none;
            stroke: var(--accent);
            stroke-width: 1.5;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .mode-card.selected .mode-icon svg {
            stroke: var(--text-bright);
        }
        .mode-card .mode-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-bright);
        }
        .mode-card .mode-desc {
            font-size: 10px;
            color: var(--text-color);
            margin-top: 2px;
            opacity: 0.7;
        }

        /* Limit input */
        .limit-input-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .limit-input-group input[type="number"] {
            width: 100px;
            padding: 6px 10px;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-bright);
            font-size: 13px;
            outline: none;
        }
        .limit-input-group input[type="number"]:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
        }
        .limit-input-group .unit {
            font-size: 12px;
            color: var(--text-color);
            opacity: 0.7;
        }

        /* -- Toolbar ---------------------------------------- */
        .toolbar {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            align-items: center;
        }
        button {
            background-color: var(--surface);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 5px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
        }
        button:hover { background-color: var(--surface-hover); border-color: #555; }
        button.primary {
            background: linear-gradient(135deg, var(--accent), #0098ff);
            color: white;
            border: none;
            font-weight: 600;
            padding: 8px 20px;
            font-size: 13px;
            border-radius: 6px;
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

        .toolbar-spacer { flex: 1; }

        .search-box {
            padding: 5px 10px;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-color);
            font-size: 12px;
            width: 200px;
            outline: none;
        }
        .search-box:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
        }
        .search-box::placeholder { color: #666; }

        /* -- Tree ------------------------------------------- */
        .tree-container {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background-color: var(--surface);
            padding: 12px;
        }
        .tree-container::-webkit-scrollbar { width: 8px; }
        .tree-container::-webkit-scrollbar-track { background: transparent; }
        .tree-container::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
        .tree-container::-webkit-scrollbar-thumb:hover { background: #777; }

        ul.tree-list {
            list-style-type: none;
            padding-left: 22px;
            margin: 0;
        }
        .tree-container > ul.tree-list { padding-left: 0; }

        li { margin: 1px 0; }

        .tree-item {
            display: flex;
            align-items: center;
            padding: 3px 6px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.1s ease;
        }
        .tree-item:hover { background-color: var(--surface-hover); }
        .tree-item.hidden { display: none; }

        .toggle-icon {
            width: 18px;
            text-align: center;
            font-size: 10px;
            cursor: pointer;
            user-select: none;
            color: #888;
            transition: transform 0.15s ease;
        }
        .toggle-icon.collapsed { transform: rotate(-90deg); }
        .spacer { width: 18px; }

        .label { font-size: 13px; white-space: nowrap; }
        .label .highlight { background-color: rgba(255,200,0,0.3); border-radius: 2px; }

        /* Custom Pure CSS Folder & File Icons */
        .folder-icon {
            display: inline-block;
            width: 14px;
            height: 10px;
            background-color: var(--accent);
            border-radius: 1px 3px 2px 2px;
            position: relative;
            margin: 0 6px;
        }
        .folder-icon::before {
            content: '';
            position: absolute;
            top: -3px;
            left: 0;
            width: 6px;
            height: 3px;
            background-color: var(--accent);
            border-radius: 1px 1px 0 0;
        }
        .file-icon {
            display: inline-block;
            width: 10px;
            height: 13px;
            border: 1.5px solid var(--text-color);
            border-radius: 1px;
            position: relative;
            margin: 0 6px;
            opacity: 0.8;
        }
        .file-icon::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 0 3px 3px 0;
            border-color: transparent var(--text-color) transparent transparent;
        }

        /* Checkbox Styles */
        .checkbox-container {
            display: flex;
            align-items: center;
            position: relative;
            padding-left: 20px;
            cursor: pointer;
            user-select: none;
        }
        .checkbox-container input {
            position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0;
        }
        .checkmark {
            position: absolute;
            top: 0; left: 0;
            height: 16px; width: 16px;
            background-color: #3c3c3c;
            border-radius: 3px;
            border: 1px solid #555;
            transition: all 0.15s ease;
        }
        .checkbox-container:hover input ~ .checkmark { background-color: #4c4c4c; }
        .checkbox-container input:checked ~ .checkmark {
            background-color: var(--accent);
            border-color: var(--accent);
        }
        .checkbox-container input:indeterminate ~ .checkmark {
            background-color: var(--accent);
            border-color: var(--accent);
        }
        .checkmark:after {
            content: "";
            position: absolute;
            display: none;
        }
        .checkbox-container input:checked ~ .checkmark:after { display: block; }
        .checkbox-container input:indeterminate ~ .checkmark:after { display: block; }
        .checkbox-container .checkmark:after {
            left: 5px; top: 1px;
            width: 3px; height: 8px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
        }
        .checkbox-container input:indeterminate ~ .checkmark:after {
            left: 3px; top: 6px;
            width: 8px; height: 2px;
            background-color: white;
            border: none;
            transform: none;
        }

        /* -- Footer ----------------------------------------- */
        .footer {
            margin-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
        }
        .stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
        }
        .stat-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .stat-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        .stat-dot.files { background: var(--accent); }
        .stat-dot.size { background: var(--success); }
        .stat-dot.parts { background: var(--warning); }

        /* -- Info banner ------------------------------------ */
        .info-banner {
            background: rgba(0,122,204,0.1);
            border: 1px solid rgba(0,122,204,0.3);
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 14px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .info-banner .info-icon { display: flex; align-items: center; color: var(--accent); }
    </style>
</head>
<body>
    <div class="header">
        <h2>Merge & Export</h2>
        <span class="badge">SMART EXPORTER</span>
    </div>

    <div class="info-banner">
        <span class="info-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
        <span>Select files and folders below, then choose a merge mode. Files will be combined into structured text files with headers, tree diagrams, and full source contents.</span>
    </div>

    <div class="settings-panel">
        <h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Export Settings</h3>
        <div class="settings-row">
            <div class="setting-group">
                <label>Export Mode</label>
                <div class="mode-options">
                    <label class="mode-card selected" data-mode="folder">
                        <input type="radio" name="mode" value="folder" checked>
                        <div class="mode-icon"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
                        <div class="mode-label">Per Folder</div>
                        <div class="mode-desc">One file per folder</div>
                    </label>
                    <label class="mode-card" data-mode="multi">
                        <input type="radio" name="mode" value="multi">
                        <div class="mode-icon"><svg viewBox="0 0 24 24"><path d="M2 4h6v6H2zM16 4h6v6h-6zM9 14h6v6H9zM2 17h4M18 17h4M12 8v4"/></svg></div>
                        <div class="mode-label">Multi-Folder</div>
                        <div class="mode-desc">Merge folders together</div>
                    </label>
                    <label class="mode-card" data-mode="nuclear">
                        <input type="radio" name="mode" value="nuclear">
                        <div class="mode-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="2" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="22" y2="12"/></svg></div>
                        <div class="mode-label">Nuclear</div>
                        <div class="mode-desc">Entire project as one</div>
                    </label>
                </div>
            </div>
            <div class="setting-group" style="max-width:220px;">
                <label>Max File Size Limit</label>
                <div class="limit-input-group">
                    <input type="number" id="fileLimitInput" value="500" min="10" max="50000" step="10">
                    <span class="unit">KB</span>
                </div>
                <div style="font-size:11px; color:#888; margin-top:6px;">
                    Files split automatically when exceeding this limit
                </div>
            </div>
        </div>
    </div>

    <div class="toolbar">
        <button id="expandAllBtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="6 9 12 15 18 9"/></svg>Expand All</button>
        <button id="collapseAllBtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="18 15 12 9 6 15"/></svg>Collapse All</button>
        <button id="selectAllBtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 16 10"/></svg>Select All</button>
        <button id="deselectAllBtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>Deselect All</button>
        <span class="toolbar-spacer"></span>
        <input type="text" class="search-box" id="searchBox" placeholder="Search files...">
    </div>

    <div class="tree-container">
        ${treeHtml}
    </div>

    <div class="footer">
        <div class="stats">
            <span class="stat-item"><span class="stat-dot files"></span> <span id="fileCount">0</span> files</span>
            <span class="stat-item"><span class="stat-dot size"></span> ~<span id="estSize">0</span> KB est.</span>
            <span class="stat-item"><span class="stat-dot parts"></span> ~<span id="estParts">1</span> output file(s)</span>
        </div>
        <button id="mergeBtn" class="primary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Merge & Export</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const mergeBtn = document.getElementById('mergeBtn');
        const fileCountEl = document.getElementById('fileCount');
        const estSizeEl = document.getElementById('estSize');
        const estPartsEl = document.getElementById('estParts');
        const fileLimitInput = document.getElementById('fileLimitInput');
        const expandAllBtn = document.getElementById('expandAllBtn');
        const collapseAllBtn = document.getElementById('collapseAllBtn');
        const selectAllBtn = document.getElementById('selectAllBtn');
        const deselectAllBtn = document.getElementById('deselectAllBtn');
        const searchBox = document.getElementById('searchBox');

        const modeCards = document.querySelectorAll('.mode-card');
        let currentMode = 'folder';

        modeCards.forEach(card => {
            card.addEventListener('click', () => {
                modeCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const radio = card.querySelector('input[type="radio"]');
                radio.checked = true;
                currentMode = radio.value;
                updateStats();
            });
        });

        fileLimitInput.addEventListener('input', () => { updateStats(); });

        document.querySelectorAll('.toggle-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleNode(icon);
            });
        });

        function toggleNode(icon) {
            const li = icon.closest('li');
            const ul = li.querySelector('ul');
            if (ul) {
                if (ul.style.display === 'none') {
                    ul.style.display = 'block';
                    icon.classList.remove('collapsed');
                    icon.classList.add('expanded');
                    icon.textContent = 'v';
                } else {
                    ul.style.display = 'none';
                    icon.classList.remove('expanded');
                    icon.classList.add('collapsed');
                    icon.textContent = '';
                }
            }
        }

        expandAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.tree-list ul').forEach(ul => ul.style.display = 'block');
            document.querySelectorAll('.toggle-icon').forEach(icon => {
                icon.classList.remove('collapsed');
                icon.classList.add('expanded');
                icon.textContent = 'v';
            });
        });

        collapseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.tree-list ul').forEach(ul => ul.style.display = 'none');
            document.querySelectorAll('.toggle-icon').forEach(icon => {
                icon.classList.remove('expanded');
                icon.classList.add('collapsed');
                icon.textContent = '';
            });
        });

        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
                cb.indeterminate = false;
            });
            updateStats();
        });

        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
                cb.indeterminate = false;
            });
            updateStats();
        });

        searchBox.addEventListener('input', () => {
            const query = searchBox.value.toLowerCase().trim();
            document.querySelectorAll('.tree-item').forEach(item => {
                const label = item.querySelector('.label');
                if (!label) return;
                const text = label.textContent.toLowerCase();

                if (!query) {
                    item.classList.remove('hidden');
                    label.innerHTML = label.textContent;
                    return;
                }

                if (text.includes(query)) {
                    item.classList.remove('hidden');
                    const idx = text.indexOf(query);
                    const orig = label.textContent;
                    label.innerHTML = orig.substring(0, idx) +
                        '<span class="highlight">' + orig.substring(idx, idx + query.length) + '</span>' +
                        orig.substring(idx + query.length);
                    let parent = item.closest('ul');
                    while (parent) {
                        if (parent.style.display === 'none') {
                            parent.style.display = 'block';
                        }
                        const parentItem = parent.closest('li');
                        if (parentItem) {
                            const pi = parentItem.querySelector(':scope > .tree-item');
                            if (pi) pi.classList.remove('hidden');
                        }
                        parent = parentItem ? parentItem.closest('ul') : null;
                    }
                } else {
                    if (item.classList.contains('file-item')) {
                        item.classList.add('hidden');
                    }
                }
            });

            if (query) {
                document.querySelectorAll('.folder-item').forEach(folder => {
                    const li = folder.closest('li');
                    const childItems = li.querySelectorAll('.file-item:not(.hidden)');
                    if (childItems.length === 0) {
                        folder.classList.add('hidden');
                    }
                });
            }
        });

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
                updateStats();
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

        function updateStats() {
            const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
            const count = checkedFiles.length;
            fileCountEl.textContent = count;

            const avgFileSize = 2;
            const headerOverhead = 0.5;
            const totalEstKB = Math.round(count * (avgFileSize + headerOverhead));
            estSizeEl.textContent = totalEstKB;

            const limit = parseInt(fileLimitInput.value) || 500;
            const parts = totalEstKB > 0 ? Math.max(1, Math.ceil(totalEstKB / limit)) : 0;
            estPartsEl.textContent = parts;

            if (count === 0) {
                mergeBtn.disabled = true;
            } else {
                mergeBtn.disabled = false;
            }
        }

        mergeBtn.addEventListener('click', () => {
            const selectedFiles = [];
            document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
                selectedFiles.push(cb.value);
            });

            const limit = parseInt(fileLimitInput.value) || 500;

            vscode.postMessage({
                command: 'mergeExport',
                files: selectedFiles,
                mode: currentMode,
                fileLimitKB: limit
            });
        });

        updateStats();
    </script>
</body>
</html>`;
}