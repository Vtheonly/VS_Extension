import * as vscode from 'vscode';
import { getWebviewContent } from './webviewContent';

export function getMergeWebviewContent(webview: vscode.Webview, defaultWorkspacePath = ''): string {
    return getWebviewContent(webview, defaultWorkspacePath);
}