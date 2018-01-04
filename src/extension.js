const vscode = require('vscode');
const Resolver = require('./Resolver');

function activate(context) {
    let resolver = new Resolver();

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.import', () => resolver.importCommand())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.expand', () => resolver.expandCommand())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.sort', () => resolver.sortCommand())
    );

    context.subscriptions.push(resolver);
}

exports.activate = activate;
