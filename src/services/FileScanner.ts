import * as fs from 'fs';
import * as path from 'path';
import { IFileScanner } from '../core/interfaces';

export class FileScanner implements IFileScanner {
    constructor(
        private readonly allowedExtensions: Set<string>,
        private readonly allowedFilenames: Set<string>,
        private readonly excludeDirs: Set<string>
    ) {}

    public async scan(paths: string[]): Promise<string[]> {
        const results: string[] = [];
        for (const p of paths) {
            try {
                await this.traverse(p, results);
            } catch {
                // Fail-safe file access bounds handling
            }
        }
        return results;
    }

    public isDefaultIncluded(filePath: string, rootPath: string): boolean {
        const resolvedFile = path.resolve(filePath);
        const resolvedRoot = path.resolve(rootPath);
        const rel = path.relative(resolvedRoot, resolvedFile);
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
            return false;
        }
        const parts = rel.split(path.sep);
        for (let i = 0; i < parts.length - 1; i++) {
            if (this.excludeDirs.has(parts[i])) {
                return false;
            }
        }
        return this.shouldIncludeFile(resolvedFile);
    }

    private shouldIncludeFile(filePath: string): boolean {
        const basename = path.basename(filePath);
        const ext = path.extname(filePath);
        if (this.allowedExtensions.has(ext)) { return true; }
        if (this.allowedFilenames.has(basename)) { return true; }
        if (basename.startsWith('.env')) { return true; }
        return false;
    }

    private async traverse(currentPath: string, results: string[]): Promise<void> {
        const stat = await fs.promises.stat(currentPath);
        if (stat.isDirectory()) {
            if (this.excludeDirs.has(path.basename(currentPath))) { return; }
            const children = await fs.promises.readdir(currentPath);
            for (const child of children) {
                await this.traverse(path.join(currentPath, child), results);
            }
        } else if (stat.isFile() && this.shouldIncludeFile(currentPath)) {
            results.push(currentPath);
        }
    }
}