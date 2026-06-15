import { IMermaidFixer } from '../core/interfaces';

export class MermaidFixer implements IMermaidFixer {
    public transform(content: string): string {
        return content.replace(/```mermaid\r?\n([\s\S]*?)```/g, (match, block) => {
            return '```mermaid\n' + this.fixBlock(block) + '\n```';
        });
    }

    private fixBlock(block: string): string {
        const lines = block.split(/\r?\n/);
        const fixedLines = lines.map(line => {
            // 1. Fix unquoted subgraph label: subgraph Name [Label] -> subgraph Name["Label"]
            line = line.replace(/^(\s*subgraph\s+\w+)\s+\[([^"([][^\]]*)\]/g, '$1["$2"]');
            
            // 2. Fix unquoted node label: Node[Label] -> Node["Label"]
            line = line.replace(/(?<![a-zA-Z0-9_])([a-zA-Z_][a-zA-Z0-9_-]*)\[([^"([\]]+)\]/g, '$1["$2"]');
            
            // 3. Fix ordered list triggers to prevent Markdown pre-processing errors
            line = line.replace(/"(\d)\.\s+/g, '"$1: ');
            line = line.replace(/\|(\d)\.\s+/g, '|$1: ');
            
            return line;
        });
        return fixedLines.join('\n');
    }
}
