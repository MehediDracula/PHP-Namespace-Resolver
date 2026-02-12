import * as vscode from 'vscode';

const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showStatusMessage(message: string, timeout = 3000): void {
    if (hideTimer) { clearTimeout(hideTimer); }
    item.text = message;
    item.show();
    hideTimer = setTimeout(() => item.hide(), timeout);
}

export function disposeStatusBar(): void {
    if (hideTimer) { clearTimeout(hideTimer); }
    item.dispose();
}
