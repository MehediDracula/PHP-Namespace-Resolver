import * as vscode from 'vscode';

export function showMessage(message: string): void {
    vscode.window.setStatusBarMessage(message, 3000);
}

export function showError(message: string): void {
    vscode.window.setStatusBarMessage(message, 3000);
}
