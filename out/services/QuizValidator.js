"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizValidator = void 0;
const fs = __importStar(require("fs"));
class QuizValidator {
    async validateFile(filepath) {
        const content = await fs.promises.readFile(filepath, 'utf8');
        const lines = content.split(/\r?\n/);
        const report = {
            filepath,
            isValid: true,
            errors: [],
            warnings: [],
            stats: {
                true_false: 0,
                multiple_choice: 0,
                matching: 0
            }
        };
        if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
            report.errors.push([1, "File must begin with a YAML frontmatter block (---)"]);
        }
        const closingYaml = content.indexOf('\n---', 4);
        if (closingYaml === -1) {
            report.errors.push([1, "YAML frontmatter closing block (---) is missing"]);
            report.isValid = false;
            return report;
        }
        const frontmatter = content.substring(4, closingYaml);
        if (!frontmatter.includes('sources:')) {
            report.errors.push([2, "YAML frontmatter is missing the mandatory 'sources:' metadata key"]);
        }
        if (!/\[\[.*?\]\]/.test(frontmatter)) {
            report.warnings.push([2, "No valid internal wiki-links [[Link]] found in frontmatter sources"]);
        }
        const body = content.substring(closingYaml + 5);
        const questionBlocks = body.split(/\n(?=>\s*\[!question\])/);
        let blockIndex = 1;
        for (let block of questionBlocks) {
            block = block.trim();
            if (!block)
                continue;
            const firstLine = block.split('\n')[0].trim();
            let approxLineNum = 1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(firstLine)) {
                    approxLineNum = i + 1;
                    break;
                }
            }
            const hasQuestion = />\s*\[!question\]/.test(block);
            const hasSuccessAnswer = />>\s*\[!success\]-\s*Answer/.test(block);
            const hasTrueFalseWord = />>\s*(True|False)/i.test(block);
            const hasMcOption = />\s+[a-d]\)/.test(block);
            const hasExampleCallout = /\[!example\]/.test(block);
            const hasGroupA = /\[!example\]\s*Group A/i.test(block);
            const hasGroupB = /\[!example\]\s*Group B/i.test(block);
            const hasMatchAnswer = />>\s*[a-z]\)\s*->\s*[a-z]\)/.test(block);
            const isTf = hasQuestion && hasSuccessAnswer && hasTrueFalseWord && !hasMcOption && !hasExampleCallout;
            const isMc = hasQuestion && hasSuccessAnswer && hasMcOption && !hasExampleCallout;
            const isMatch = hasQuestion && hasExampleCallout && hasGroupA && hasGroupB && hasMatchAnswer;
            const matchesFound = (isTf ? 1 : 0) + (isMc ? 1 : 0) + (isMatch ? 1 : 0);
            if (matchesFound === 0) {
                report.errors.push([approxLineNum, `Question Block ${blockIndex}: Unable to classify question type (must be TF, MC, or Matching).`]);
                blockIndex++;
                continue;
            }
            else if (matchesFound > 1) {
                report.errors.push([approxLineNum, `Question Block ${blockIndex}: Structural conflict. Matches multiple types.`]);
                blockIndex++;
                continue;
            }
            if (isTf) {
                report.stats.true_false++;
                if (!/>>\s*(True|False)/.test(block)) {
                    report.errors.push([approxLineNum, `TF Question ${blockIndex}: Answer must be explicitly 'True' or 'False'`]);
                }
            }
            else if (isMc) {
                report.stats.multiple_choice++;
                const optionMatches = [...block.matchAll(/>\s+([a-d])\)/g)];
                const options = optionMatches.map(m => m[1]);
                const ansMatch = />>\s+([a-d])\)/.exec(block);
                if (options.length < 2) {
                    report.errors.push([approxLineNum, `MC Question ${blockIndex}: Must supply at least two valid options (a), b), etc.)`]);
                }
                if (ansMatch && !options.includes(ansMatch[1])) {
                    report.errors.push([approxLineNum, `MC Question ${blockIndex}: Declared answer '${ansMatch[1]}' is not in available options [${options.join(', ')}]`]);
                }
            }
            else if (isMatch) {
                report.stats.matching++;
                if (!/>>\s*\[!success\]-\s*Answer/.test(block)) {
                    report.errors.push([approxLineNum, `Matching Question ${blockIndex}: Missing [!success]- Answer callout`]);
                }
            }
            blockIndex++;
        }
        if (report.errors.length > 0) {
            report.isValid = false;
        }
        return report;
    }
}
exports.QuizValidator = QuizValidator;
//# sourceMappingURL=QuizValidator.js.map