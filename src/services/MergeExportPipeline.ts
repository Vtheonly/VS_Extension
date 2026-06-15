import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { IMergeExportPipeline } from '../core/interfaces';

export class MergeExportPipeline implements IMergeExportPipeline {
    public async execute(
        absPaths: string[],
        rootPath: string,
        mode: string,
        limitKB: number
    ): Promise<void> {
        const projectName = path.basename(rootPath);
        const dateStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const timestamp = dateStr.replace(/[: ]/g, '-');

        const dstDir = path.join(os.homedir(), 'Downloads', `${projectName}_merged_${timestamp}`);
        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir, { recursive: true });
        }

        const relPaths = absPaths.map(p => path.relative(rootPath, p).split(path.sep).join('/'));
        const fileContents = new Map<string, string>();

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Reading files...",
            cancellable: false
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

        let groups: Map<string, string[]>;
        if (mode === 'nuclear') {
            groups = new Map([['(entire project)', relPaths]]);
        } else if (mode === 'multi') {
            groups = new Map([['(selected folders)', relPaths]]);
        } else {
            groups = this.groupByFolder(relPaths);
        }

        const limitBytes = limitKB * 1024;
        let totalOutputFiles = 0;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Merging & exporting...",
            cancellable: false
        }, async () => {
            for (const [groupName, groupFiles] of groups.entries()) {
                const blocks: { relPath: string; text: string; size: number }[] = [];
                for (const rel of groupFiles) {
                    const content = fileContents.get(rel) || '';
                    const text = this.buildFileBlock(rel, content);
                    blocks.push({ relPath: rel, text, size: Buffer.byteLength(text, 'utf8') });
                }

                const parts: { relPath: string; text: string }[][] = [[]];
                let currentPartSize = 0;

                for (const block of blocks) {
                    if (currentPartSize + block.size > limitBytes && parts[parts.length - 1].length > 0) {
                        parts.push([]);
                        currentPartSize = 0;
                    }
                    parts[parts.length - 1].push(block);
                    currentPartSize += block.size;
                }

                const totalParts = parts.length;
                const safeGroup = groupName.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+/g, '_');

                for (let partIdx = 0; partIdx < totalParts; partIdx++) {
                    const partFiles = parts[partIdx];
                    const partRelPaths = partFiles.map(b => b.relPath);

                    const header = this.buildHeader(projectName, [groupName], partIdx + 1, totalParts, dateStr);
                    const treeDiagram = this.buildTreeDiagram(partRelPaths);

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
            `Merged ${relPaths.length} files into ${totalOutputFiles} output file(s) -> ${dstDir}`
        );

        const uri = vscode.Uri.file(dstDir);
        vscode.env.openExternal(uri);
    }

    private groupByFolder(relPaths: string[]): Map<string, string[]> {
        const groups = new Map<string, string[]>();
        for (const p of relPaths) {
            const parts = p.split('/');
            const folder = parts.length > 1 ? parts[0] : '.';
            if (!groups.has(folder)) { groups.set(folder, []); }
            groups.get(folder)!.push(p);
        }
        return groups;
    }

    private buildHeader(
        projectName: string,
        sourcePaths: string[],
        partNum: number,
        totalParts: number,
        dateStr: string
    ): string {
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

    private buildFileBlock(relPath: string, content: string): string {
        const sep = '='.repeat(72);
        const lang = this.langHint(relPath);
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

    private buildTreeDiagram(relativePaths: string[]): string {
        interface TreeNode { [key: string]: TreeNode | null; }
        const root: TreeNode = {};

        for (const p of relativePaths) {
            const parts = p.split('/');
            let cur: TreeNode = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    cur[part] = null;
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
                const connector = isLast ? '\\-- ' : '|-- ';
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

    private langHint(filePath: string): string {
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
}