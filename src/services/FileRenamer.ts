import * as fs from 'fs';
import * as path from 'path';
import { IFileRenamer } from '../core/interfaces';

export class FileRenamer implements IFileRenamer {
    public generateMapMapping(currentFiles: string[], mappingDict: Record<string, string>): Record<string, string> {
        const mapping: Record<string, string> = {};
        for (const [k, v] of Object.entries(mappingDict)) {
            if (currentFiles.includes(k)) {
                mapping[k] = v;
            }
        }
        return mapping;
    }

    public generateRegexMapping(
        currentFiles: string[],
        patternStr: string,
        replacementFormat: string
    ): Record<string, string> {
        const regex = new RegExp(patternStr);
        const mapping: Record<string, string> = {};

        for (const f of currentFiles) {
            const match = regex.exec(f);
            if (match) {
                const groupDict: Record<string, string> = {};
                for (let i = 1; i < match.length; i++) {
                    if (match[i] !== undefined) {
                        groupDict[`g${i}`] = match[i].trim();
                    }
                }
                if (match.groups) {
                    for (const [k, v] of Object.entries(match.groups)) {
                        if (v !== undefined) {
                            groupDict[k] = v.trim();
                        }
                    }
                }

                let newName = replacementFormat;
                for (const [k, v] of Object.entries(groupDict)) {
                    newName = newName.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
                }

                if (!newName.endsWith('.md') && f.endsWith('.md')) {
                    newName += '.md';
                }
                mapping[f] = newName;
            }
        }

        return mapping;
    }

    public async executeRename(targetDir: string, mapping: Record<string, string>): Promise<void> {
        const tempMappings: Record<string, string> = {};

        // Phase 1: Rename to unique temp names to prevent intermediate collisions
        let tempCounter = 0;
        for (const [oldName, newName] of Object.entries(mapping)) {
            const oldPath = path.join(targetDir, oldName);
            if (!fs.existsSync(oldPath)) continue;

            const tempName = `rename_temp_${Date.now()}_${tempCounter++}.tmp`;
            const tempPath = path.join(targetDir, tempName);
            
            await fs.promises.rename(oldPath, tempPath);
            tempMappings[tempName] = newName;
        }

        // Phase 2: Rename from temp names to final names
        for (const [tempName, newName] of Object.entries(tempMappings)) {
            const tempPath = path.join(targetDir, tempName);
            const finalPath = path.join(targetDir, newName);

            // Ensure destination directories exist
            const destDir = path.dirname(finalPath);
            if (!fs.existsSync(destDir)) {
                await fs.promises.mkdir(destDir, { recursive: true });
            }

            await fs.promises.rename(tempPath, finalPath);
        }
    }
}
