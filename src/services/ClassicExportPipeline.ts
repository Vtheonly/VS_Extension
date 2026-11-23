import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { IExportPipeline, ExportTransformOptions } from '../core/interfaces';
import { PurificationService } from './PurificationService';
import { SkeletonizerService } from './SkeletonizerService';

export class ClassicExportPipeline implements IExportPipeline {
    public async execute(
        files: string[],
        rootPath: string,
        transformOpts?: ExportTransformOptions
    ): Promise<void> {
        let exportRelPaths = files.map(f => path.relative(rootPath, f).replace(/\\/g, '/'));

        // 1. Purify export bundle if enabled
        if (transformOpts?.purify) {
            const result = PurificationService.filterFilesForExport(exportRelPaths, {
                removeMarkdown: transformOpts.removeMarkdown,
                removeLockfiles: transformOpts.removeLockfiles,
                removeDumps: true,
            });
            exportRelPaths = result.kept;
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

        const basenameMap = new Map<string, string[]>();
        for (const rel of exportRelPaths) {
            const base = path.basename(rel);
            if (!basenameMap.has(base)) { basenameMap.set(base, []); }
            basenameMap.get(base)!.push(rel);
        }

        // Compute folder lines if MEDIUM mode is selected
        const folderLineCounts = new Map<string, number>();
        if (transformOpts?.skeletonize && transformOpts.skeletonMode === 'medium') {
            for (const rel of exportRelPaths) {
                const folder = path.dirname(rel);
                try {
                    const src = await fs.promises.readFile(path.join(rootPath, rel), 'utf8');
                    folderLineCounts.set(folder, (folderLineCounts.get(folder) || 0) + SkeletonizerService.countLines(src));
                } catch {}
            }
        }

        const projectStructureLines: string[] = [];

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exporting files...",
            cancellable: false
        }, async () => {
            for (const [basename, relPaths] of basenameMap.entries()) {
                for (const rel of relPaths) {
                    const srcPath = path.join(rootPath, rel);
                    let content = '';
                    try {
                        content = await fs.promises.readFile(srcPath, 'utf8');
                    } catch {
                        content = '// [Error reading file]';
                    }

                    // Apply Skeletonization on the exported copy
                    if (transformOpts?.skeletonize && transformOpts.skeletonMode !== 'none') {
                        const ext = path.extname(rel);
                        const folder = path.dirname(rel);
                        const shouldSkel = transformOpts.skeletonMode !== 'medium' || (folderLineCounts.get(folder) || 0) > 200;
                        if (shouldSkel) {
                            content = SkeletonizerService.skeletonizeCode(content, ext, transformOpts.skeletonMode);
                        }
                    }

                    let outFilename = basename + '.txt';
                    if (relPaths.length > 1) {
                        outFilename = rel.replace(/\//g, '_') + '.txt';
                    }

                    await fs.promises.writeFile(path.join(dstDir, outFilename), content, 'utf8');
                    projectStructureLines.push(rel);
                }
            }

            await fs.promises.writeFile(
                path.join(dstDir, 'project_structure.txt'),
                projectStructureLines.join('\n'),
                'utf8'
            );
        });

        vscode.window.showInformationMessage(`Exported ${exportRelPaths.length} files -> ${dstDir}`);
        vscode.env.openExternal(vscode.Uri.file(dstDir));
    }
}