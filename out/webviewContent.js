"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
function getWebviewContent(files) {
    const tree = {};
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
    function generateTreeHtml(node, pathPrefix = '') {
        let html = '<ul class="tree-list">';
        const keys = Object.keys(node).sort((a, b) => {
            const aIsFolder = node[a] !== null;
            const bIsFolder = node[b] !== null;
            if (aIsFolder && !bIsFolder)
                return -1;
            if (!aIsFolder && bIsFolder)
                return 1;
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
            }
            else {
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
    <title>Smart Exporter</title>
    <style>
        :root {
            --bg-color: #1e1e1e;
            --text-color: #cccccc;
            --accent-color: #007acc;
            --accent-hover: #005f9e;
            --item-hover: #2a2d2e;
            --border-color: #3e3e42;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }

        h2 { margin-top: 0; margin-bottom: 15px; color: #ffffff; font-weight: 500; }

        .controls { display: flex; gap: 10px; margin-bottom: 15px; }

        button {
            background-color: #252526;
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
        }
        button:hover { background-color: var(--item-hover); }
        button.primary {
            background-color: var(--accent-color);
            color: white;
            border: none;
            font-weight: 600;
            padding: 8px 16px;
        }
        button.primary:hover { background-color: var(--accent-hover); }

        .tree-container {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background-color: #252526;
            padding: 10px;
        }

        ul.tree-list {
            list-style-type: none;
            padding-left: 20px;
            margin: 0;
        }
        .tree-container > ul.tree-list { padding-left: 0; }

        li { margin: 2px 0; }

        .tree-item {
            display: flex;
            align-items: center;
            padding: 4px 0;
            cursor: pointer;
            border-radius: 3px;
        }
        .tree-item:hover { background-color: var(--item-hover); }

        .toggle-icon {
            width: 20px;
            text-align: center;
            font-size: 10px;
            cursor: pointer;
            user-select: none;
            color: #888;
        }
        .toggle-icon.collapsed { transform: rotate(-90deg); }
        .spacer { width: 20px; }

        .label { font-size: 13px; white-space: nowrap; }

        /* Custom Pure CSS Icons */
        .folder-icon {
            display: inline-block;
            width: 14px;
            height: 10px;
            background-color: var(--accent-color);
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
            background-color: var(--accent-color);
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
            position: absolute;
            opacity: 0;
            cursor: pointer;
            height: 0;
            width: 0;
        }
        .checkmark {
            position: absolute;
            top: 0;
            left: 0;
            height: 16px;
            width: 16px;
            background-color: #3c3c3c;
            border-radius: 3px;
            border: 1px solid #555;
        }
        .checkbox-container:hover input ~ .checkmark { background-color: #4c4c4c; }
        .checkbox-container input:checked ~ .checkmark {
            background-color: var(--accent-color);
            border-color: var(--accent-color);
        }
        .checkbox-container input:indeterminate ~ .checkmark {
            background-color: var(--accent-color);
            border-color: var(--accent-color);
        }
        
        .checkmark:after {
            content: "";
            position: absolute;
            display: none;
        }
        .checkbox-container input:checked ~ .checkmark:after { display: block; }
        .checkbox-container input:indeterminate ~ .checkmark:after { display: block; }

        .checkbox-container .checkmark:after {
            left: 5px;
            top: 1px;
            width: 3px;
            height: 8px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
        }
        .checkbox-container input:indeterminate ~ .checkmark:after {
            left: 3px;
            top: 6px;
            width: 8px;
            height: 2px;
            background-color: white;
            border: none;
            transform: none;
        }

        .footer {
            margin-top: 20px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 15px;
        }
        .count-label { font-size: 13px; opacity: 0.8; }
    </style>
</head>
<body>
    <h2>Select Files to Export</h2>
    
    <div class="controls">
        <button id="expandAllBtn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="6 9 12 15 18 9"/></svg>Expand All
        </button>
        <button id="collapseAllBtn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="18 15 12 9 6 15"/></svg>Collapse All
        </button>
    </div>

    <div class="tree-container">
        ${treeHtml}
    </div>

    <div class="footer">
        <span class="count-label" id="countLabel">0 files selected</span>
        <button id="exportBtn" class="primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Export Selected
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const exportBtn = document.getElementById('exportBtn');
        const countLabel = document.getElementById('countLabel');
        const expandAllBtn = document.getElementById('expandAllBtn');
        const collapseAllBtn = document.getElementById('collapseAllBtn');

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
                updateCount();
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

        function updateCount() {
            const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
            const count = checkedFiles.length;
            countLabel.textContent = count + ' files selected';
            
            if (count === 0) {
                exportBtn.disabled = true;
                exportBtn.style.opacity = '0.5';
                exportBtn.style.cursor = 'not-allowed';
            } else {
                exportBtn.disabled = false;
                exportBtn.style.opacity = '1';
                exportBtn.style.cursor = 'pointer';
            }
        }

        exportBtn.addEventListener('click', () => {
            const selectedFiles = [];
            document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
                selectedFiles.push(cb.value);
            });
            
            vscode.postMessage({
                command: 'export',
                files: selectedFiles
            });
        });

        updateCount();
    </script>
</body>
</html>`;
}
//# sourceMappingURL=webviewContent.js.map