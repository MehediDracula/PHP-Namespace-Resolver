const vscode = require('vscode');
const Resolver = require('./Resolver');

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

    context.subscriptions.push(resolver);
}

exports.activate = activate;
