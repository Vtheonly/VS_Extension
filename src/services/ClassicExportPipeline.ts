import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { IExportPipeline } from '../core/interfaces';

export class ClassicExportPipeline implements IExportPipeline {
    public async execute(files: string[], rootPath: string): Promise<void> {
        const basenameMap = new Map<string, string[]>();
        for (const filePath of files) {
            const base = path.basename(filePath);
            if (!basenameMap.has(base)) { basenameMap.set(base, []); }
            basenameMap.get(base)!.push(filePath);
        }

        const homeDir = os.homedir();
        const projectName = path.basename(rootPath);
        const timestamp = new Date().toISOString()
            .replace(/T/, '_')
            .replace(/\..+/, '')
            .replace(/:/g, '-');
        const dstDir = path.join(homeDir, 'Downloads', `${projectName}_${timestamp}`);
        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir, { recursive: true });
        }

        const projectStructureLines: string[] = [];

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exporting files...",
            cancellable: false
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
            await fs.promises.writeFile(
                path.join(dstDir, 'project_structure.txt'),
                projectStructureLines.join('\n'),
                'utf8'
            );
        });

        vscode.window.showInformationMessage(`Exported ${files.length} files -> ${dstDir}`);
    }
}
