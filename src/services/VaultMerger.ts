import * as fs from 'fs';
import * as path from 'path';
import { IVaultMerger, ParsedSegment } from '../core/interfaces';

export class VaultMerger implements IVaultMerger {
    public async merge(
        segments: ParsedSegment[],
        targetDir: string,
        mode: 'side_by_side' | 'overwrite' | 'skip',
        conflictSuffix = ' (Vault 1)'
    ): Promise<number> {
        let writtenCount = 0;

        for (const segment of segments) {
            const cleanFolder = segment.folder.replace(/:/g, '-').replace(/\//g, '-');
            const cleanFilename = segment.filename.replace(/:/g, '-').replace(/\//g, '-');

            const targetFolder = path.join(targetDir, cleanFolder);
            if (!fs.existsSync(targetFolder)) {
                await fs.promises.mkdir(targetFolder, { recursive: true });
            }

            let targetFilePath = path.join(targetFolder, cleanFilename);

            if (fs.existsSync(targetFilePath)) {
                if (mode === 'side_by_side') {
                    const ext = path.extname(cleanFilename);
                    const base = path.basename(cleanFilename, ext);
                    const conflictingFilename = `${base}${conflictSuffix}${ext}`;
                    targetFilePath = path.join(targetFolder, conflictingFilename);
                } else if (mode === 'skip') {
                    continue;
                }
            }

            await fs.promises.writeFile(targetFilePath, segment.content, 'utf8');
            writtenCount++;
        }

        return writtenCount;
    }
}