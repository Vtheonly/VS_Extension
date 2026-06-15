import { getWebviewContent } from './webviewContent';

export function getMergeWebviewContent(files: string[]): string {
    return getWebviewContent(files);
}