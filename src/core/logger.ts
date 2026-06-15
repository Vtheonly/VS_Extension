import * as vscode from 'vscode';
import { ILogger } from './interfaces';

export class ExtensionLogger implements ILogger {
    private channel: vscode.OutputChannel;

    constructor(name: string) {
        this.channel = vscode.window.createOutputChannel(name);
    }

    public info(message: string): void {
        this.channel.appendLine(`[INFO] ${message}`);
    }

    public warn(message: string): void {
        this.channel.appendLine(`[WARNING] ${message}`);
    }

    public error(message: string): void {
        this.channel.appendLine(`[ERROR] ${message}`);
    }

    public show(): void {
        this.channel.show(true);
    }
}
