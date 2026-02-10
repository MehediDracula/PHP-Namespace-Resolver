import * as vscode from 'vscode';
import { getConfig } from './config';

export function showMessage(message: string): void {
    if (getConfig('showMessageOnStatusBar')) {
        vscode.window.setStatusBarMessage(message, 3000);
        return;
    }
    const clean = message.replace(/\$\(.+?\)\s\s/, '');
    vscode.window.showInformationMessage(clean);
}

export function showError(message: string): void {
    if (getConfig('showMessageOnStatusBar')) {
        vscode.window.setStatusBarMessage(message, 3000);
        return;
    }
    const clean = message.replace(/\$\(.+?\)\s\s/, '');
    vscode.window.showErrorMessage(clean);
}
