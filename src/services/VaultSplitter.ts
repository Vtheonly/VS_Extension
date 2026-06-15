import { IVaultSplitter, ParsedSegment, SplitRule } from '../core/interfaces';

export class VaultSplitter implements IVaultSplitter {
    public parse(
        content: string,
        rules: SplitRule[],
        defaultFolder = '',
        defaultFile = 'Introduction.md'
    ): ParsedSegment[] {
        const segments: ParsedSegment[] = [];
        
        // Compile regexes
        const compiledRules = rules.map(rule => {
            return {
                type: rule.type,
                regex: new RegExp(rule.pattern, 'm'),
                folderFormat: rule.folder_format,
                fileFormat: rule.file_format
            };
        });

        const lines = content.split(/\r?\n/);
        let currentFolder = defaultFolder;
        let currentFile = defaultFile;
        let currentContent: string[] = [];

        const saveSegment = () => {
            if (currentContent.length > 0 || currentFile !== 'Introduction.md') {
                let body = currentContent.join('\n').trim();
                if (body.endsWith('---')) {
                    body = body.slice(0, -3).trim();
                }
                if (body.startsWith('---')) {
                    body = body.slice(3).trim();
                }
                segments.push({
                    folder: currentFolder,
                    filename: currentFile,
                    content: body
                });
            }
        };

        for (const line of lines) {
            let matched = false;
            for (const rule of compiledRules) {
                const match = rule.regex.exec(line);
                if (match) {
                    saveSegment();
                    currentContent = [];

                    // Extract groups
                    const groupDict: Record<string, string> = {};
                    for (let i = 1; i < match.length; i++) {
                        if (match[i] !== undefined) {
                            groupDict[`g${i}`] = match[i].trim();
                        }
                    }
                    
                    // Extract named groups if any
                    if (match.groups) {
                        for (const [k, v] of Object.entries(match.groups)) {
                            if (v !== undefined) {
                                groupDict[k] = v.trim();
                            }
                        }
                    }

                    // Interpolate folder
                    if (rule.folderFormat) {
                        currentFolder = this.interpolate(rule.folderFormat, groupDict);
                    }
                    // Interpolate file
                    if (rule.fileFormat) {
                        currentFile = this.interpolate(rule.fileFormat, groupDict);
                    } else {
                        currentFile = 'Section.md';
                    }

                    if (!currentFile.endsWith('.md')) {
                        currentFile += '.md';
                    }

                    currentContent.push(line);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                currentContent.push(line);
            }
        }

        saveSegment();
        return segments;
    }

    private interpolate(format: string, dict: Record<string, string>): string {
        let result = format;
        for (const [k, v] of Object.entries(dict)) {
            result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        return result;
    }
}
