"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MermaidFixer = void 0;
class MermaidFixer {
    transform(content) {
        return content.replace(/```mermaid\r?\n([\s\S]*?)```/g, (match, block) => {
            return '```mermaid\n' + this.fixBlock(block) + '\n```';
        });
    }
    fixBlock(block) {
        const lines = block.split(/\r?\n/);
        const fixedLines = lines.map(line => {
            line = line.replace(/^(\s*subgraph\s+\w+)\s+\[([^"([][^\]]*)\]/g, '$1["$2"]');
            line = line.replace(/(?<![a-zA-Z0-9_])([a-zA-Z_][a-zA-Z0-9_-]*)\[([^"([\]]+)\]/g, '$1["$2"]');
            line = line.replace(/"(\d)\.\s+/g, '"$1: ');
            line = line.replace(/\|(\d)\.\s+/g, '|$1: ');
            return line;
        });
        return fixedLines.join('\n');
    }
}
exports.MermaidFixer = MermaidFixer;
//# sourceMappingURL=MermaidFixer.js.map