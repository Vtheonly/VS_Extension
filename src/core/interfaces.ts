import { PurgeSummary } from '../emojiPurgeService';

export interface ILogger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    show(): void;
}

export interface IFileScanner {
    scan(paths: string[]): Promise<string[]>;
}

export interface IExportPipeline {
    execute(files: string[], rootPath: string): Promise<void>;
}

export interface IMergeExportPipeline {
    execute(
        absPaths: string[],
        rootPath: string,
        mode: string,
        limitKB: number
    ): Promise<void>;
}

export interface IEmojiPurgeService {
    purgePaths(
        paths: string[],
        onProgress?: (msg: string) => void
    ): Promise<PurgeSummary>;
}

export interface ParsedSegment {
    folder: string;
    filename: string;
    content: string;
}

export interface SplitRule {
    type: string;
    pattern: string;
    folder_format: string;
    file_format: string;
}

export interface IVaultSplitter {
    parse(
        content: string,
        rules: SplitRule[],
        defaultFolder?: string,
        defaultFile?: string
    ): ParsedSegment[];
}

export interface IVaultMerger {
    merge(
        segments: ParsedSegment[],
        targetDir: string,
        mode: 'side_by_side' | 'overwrite' | 'skip',
        conflictSuffix?: string
    ): Promise<number>;
}

export interface IMermaidFixer {
    transform(content: string): string;
}

export interface ValidationReport {
    filepath: string;
    isValid: boolean;
    errors: [number, string][];
    warnings: [number, string][];
    stats: {
        true_false: number;
        multiple_choice: number;
        matching: number;
    };
}

export interface IQuizValidator {
    validateFile(filepath: string): Promise<ValidationReport>;
}

export interface IFileRenamer {
    generateMapMapping(currentFiles: string[], mappingDict: Record<string, string>): Record<string, string>;
    generateRegexMapping(
        currentFiles: string[],
        patternStr: string,
        replacementFormat: string
    ): Record<string, string>;
    executeRename(targetDir: string, mapping: Record<string, string>): Promise<void>;
}