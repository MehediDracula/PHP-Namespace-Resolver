let vscode = require('vscode');
let Resolver = require('./Resolver');

function activate(context) {
    let resolver = new Resolver;

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.import', async () => {
            let selections = vscode.window.activeTextEditor.selections;

            for (let i = 0; i < selections.length; i++) {
                await resolver.importCommand(selections[i]);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.expand', async () => {
            let selections = vscode.window.activeTextEditor.selections;

            for (let i = 0; i < selections.length; i++) {
                await resolver.expandCommand(selections[i]);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.sort', () => resolver.sortCommand())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.importAll', () => resolver.importAll())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.highlightNotImported', () => resolver.highlightNotImported())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.highlightNotUsed', () => resolver.highlightNotUsed())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.generateNamespace', () => resolver.generateNamespace())
    );

    context.subscriptions.push(vscode.workspace.onWillSaveTextDocument((event) => {
        if (
            event &&
            event.document.languageId === 'php' &&
            vscode.workspace.getConfiguration('namespaceResolver').get('sortOnSave')
        ) {
            resolver.sortCommand();
        }

        if (
            event &&
            event.document.languageId === 'php' &&
            vscode.workspace.getConfiguration('namespaceResolver').get('highlightOnSave')
        ) {
            resolver.highlightNotImported();
            resolver.highlightNotUsed();
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((event) => {
        if (
            event &&
            event.document.languageId === 'php' &&
            vscode.workspace.getConfiguration('namespaceResolver').get('highlightOnOpen')
        ) {
            resolver.highlightNotImported();
            resolver.highlightNotUsed();
        }
    }));

    context.subscriptions.push(resolver);
}

exports.activate = activate;
