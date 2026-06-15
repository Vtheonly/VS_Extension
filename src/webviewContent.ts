import * as vscode from 'vscode';

export function getWebviewContent(files: string[]): string {
    // Convert flat list of paths to a tree structure
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

    // Recursive function to generate HTML for the tree
    function generateTreeHtml(node: any, pathPrefix: string = ''): string {
        let html = '<ul class="tree-list">';
        // Sort keys: folders first, then files
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
                        <span class="toggle-icon expanded">V</span>
                        <label class="checkbox-container">
                            <input type="checkbox" class="folder-checkbox" data-path="${fullPath}" checked>
                            <span class="checkmark"></span>
                        </label>
                        <span class="icon folder-icon"></span>
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
                        <span class="icon file-icon"></span>
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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
        /* Root level list has no padding */
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

        .icon { margin: 0 6px; font-size: 16px; }
        .label { font-size: 13px; white-space: nowrap; }

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
        /* Indeterminate State */
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

        /* Checkmark Icon */
        .checkbox-container .checkmark:after {
            left: 5px;
            top: 1px;
            width: 3px;
            height: 8px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
        }
        /* Indeterminate Dash */
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
        <button id="expandAllBtn">Expand All</button>
        <button id="collapseAllBtn">Collapse All</button>
    </div>

    <div class="tree-container">
        ${treeHtml}
    </div>

    <div class="footer">
        <span class="count-label" id="countLabel">0 files selected</span>
        <button id="exportBtn" class="primary">Export Selected</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const exportBtn = document.getElementById('exportBtn');
        const countLabel = document.getElementById('countLabel');
        const expandAllBtn = document.getElementById('expandAllBtn');
        const collapseAllBtn = document.getElementById('collapseAllBtn');

        // --- Tree Toggle Logic ---
        document.querySelectorAll('.toggle-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering row click
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
                    icon.textContent = 'V';
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
                icon.textContent = 'V';
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


        // --- Checkbox Cascading Logic ---
        
        // 1. Handle Folder/File Checkbox Click
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const li = e.target.closest('li');
                
                // Propagate DOWN: Select/Deselect all children
                const children = li.querySelectorAll('input[type="checkbox"]');
                children.forEach(child => {
                    child.checked = isChecked;
                    child.indeterminate = false;
                });

                // Propagate UP: Update parent states
                updateParents(li);
                updateCount();
            });
        });

        function updateParents(element) {
            const parentUl = element.closest('ul');
            if (!parentUl) return; // Reached root

            const parentLi = parentUl.closest('li');
            if (!parentLi) return; // Reached root container

            const parentCheckbox = parentLi.querySelector(':scope > .tree-item > .checkbox-container > input');
            if (!parentCheckbox) return;

            const siblings = parentUl.querySelectorAll(':scope > li > .tree-item > .checkbox-container > input');
            let allChecked = true;
            let allUnchecked = true;
            let anyIndeterminate = false;

            siblings.forEach(sib => {
                if (!sib.checked) allChecked = false;
                if (sib.checked || sib.indeterminate) allUnchecked = false;
                if (sib.indeterminate) anyIndeterminate = true;
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

            // Recursively update upwards
            updateParents(parentLi);
        }

        function updateCount() {
            const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
            const count = checkedFiles.length;
            countLabel.textContent = \`\${count} files selected\`;
            
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

        // Initialize
        updateCount();
    </script>
</body>
</html>`;
}
