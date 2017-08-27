let vscode = require('vscode');
let editor = vscode.window.activeTextEditor;
let config = vscode.workspace.getConfiguration('namespaceResolver');

class Resolver {
    importNamespace() {
        this.findFiles()
            .then(files => this.findNamespaces(files))
            .then(namespaces => this.pickNamespace(namespaces))
            .then(pickedNamespace => this.insertNamespace(pickedNamespace))
            .then(useStatements => this.sortImports(useStatements));
    }

    expandNamespace() {
        this.findFiles()
            .then(files => this.findNamespaces(files))
            .then(namespaces => this.pickNamespace(namespaces))
            .then(pickedNamespace => this.expandToFqn(pickedNamespace));
    }

    sortNamespaces() {
        this.sortImports(
            this.getDeclarations()
        );
    }

    findFiles() {
        let include = '**/*.php';
        let exclude = '**/node_modules/**';

        return vscode.workspace.findFiles(include, exclude);
    }

    findNamespaces(files) {
        return new Promise((resolve, reject) => {
            let resolving = this.resolving();

            if (resolving === null) {
                return this.showMessage(`$(issue-opened)  No class is selected.`, true);
            }

            let textDocuments = this.getTextDocuments(files, resolving);

            Promise.all(textDocuments).then(docs => {
                let parsedNamespaces = this.parseNamespaces(docs, resolving);
                
                if (parsedNamespaces.length === 0) {
                    return this.showMessage(`$(circle-slash)  Class ' ${resolving} ' not found.`, true);
                }

                resolve(parsedNamespaces);
            });
        });
    }

    getTextDocuments(files, resolving) {
        let textDocuments = [];

        files.forEach(file => {
            let fileName = file.fsPath.replace(/^.*[\\\/]/, '').split('.')[0];

            if (fileName !== resolving) {
                return;
            }

            textDocuments.push(vscode.workspace.openTextDocument(file));
        });

        return textDocuments;
    }

    parseNamespaces(docs, resolving) {
        let parsedNamespaces = [];

        docs.forEach(doc => {
            for (let line = 0; line < doc.lineCount; line++) {
                let textLine = doc.lineAt(line).text;

                if (textLine.startsWith('namespace ') || textLine.startsWith('<?php namespace ')) {
                    let namespace = textLine.split('namespace ')[1].split(';')[0] + '\\' + resolving;

                    if (parsedNamespaces.indexOf(namespace) === -1) {
                        parsedNamespaces.push(namespace);
                    }
                }
            }
        });

        return parsedNamespaces;
    }

    pickNamespace(namespaces) {
        return new Promise((resolve, reject) => {
            if (namespaces.length === 1) {
                // There is only one namespace found so return with the first namespace.
                return resolve(namespaces[0]);
            }

            vscode.window.showQuickPick(namespaces).then(picked => {
                if (picked !== undefined) {
                    resolve(picked);
                }
            });
        })
    }

    insertNamespace(pickedNamespace) {
        return new Promise((resolve, reject) => {
            editor.edit(textEdit => {
                let useStatements;
                let declarationLines;

                try {
                    [useStatements, declarationLines] = this.getDeclarations(pickedNamespace);
                } catch (error) {
                    return this.showMessage(error.message);
                }

                let [prepend, append, insertLine] = this.getInsertLine(declarationLines);

                if (! config.get('autoSort', true)) {
                    // Auto sort is disabled so import the picked namespace.
                    textEdit.replace(
                        new vscode.Position((insertLine), 0),
                        `${prepend}use ${pickedNamespace};${append}`
                    );

                    return this.showMessage('$(check)  Namespace imported.');
                }

                let line = insertLine;
                
                if (useStatements.length !== 0) {
                    line = useStatements[useStatements.length - 1].line + 1;
                }

                // Auto sort is enabled so push picked namespace to the useStatements array.
                // Later it will be sorted by text length and imported.
                useStatements.push({
                    text: `use ${pickedNamespace};`,
                    line: line
                });

                resolve(useStatements);
            });
        });
    }

    expandToFqn(pickedNamespace) {
        editor.edit(textEdit => {
            textEdit.replace(
                this.getWordRange(),
                (config.get('leadingSeparator', true) ? '\\' : '') + pickedNamespace
            );
        })
    }

    sortImports(useStatements) {
        let sorted = useStatements.slice().sort((a, b) => {
            if (config.get('sortAlphabetically', false)) {
                if (a.text < b.text) return -1;
                if (a.text > b.text) return 1;
                return 0;
            } else {
                return a.text.length - b.text.length;
            }
        });

        if (config.get('autoSort', true)) {
            sorted[sorted.length - 1].text += '\n';
        }

        if (sorted.length === 1) {
            sorted[sorted.length - 1].text = `\n${sorted[sorted.length - 1].text}`;
        }

        editor.edit(textEdit => {
            for (let i = 0; i < sorted.length; i++) {
                textEdit.replace(
                    new vscode.Range(useStatements[i].line, 0, useStatements[i].line, useStatements[i].text.length),
                    sorted[i].text
                );
            }
        });

        if (config.get('autSort', true)) {
            return this.showMessage('$(check)  Namespace imported.');
        }
        
        this.showMessage('$(check)  Namespace sorted.');
    }

    getDeclarations(pickedNamespace = null) {
        let useStatements = [];
        let declarationLines = {
            PHPTag: null,
            namespace: null,
            useStatement: null,
            class: null
        };

        for (let line = 0; line < editor.document.lineCount; line++) {
            let text = editor.document.lineAt(line).text;

            if (pickedNamespace !== null && text === `use ${pickedNamespace};`) {
                // If namespace is already imported no need to get declarations.
                throw new Error('$(issue-opened)  Namespace is already imported.');
            }

            if (text.startsWith('<?php')) {
                declarationLines.PHPTag = line + 1;
            } else if (text.startsWith('namespace ')) {
                declarationLines.namespace = line + 1;
            } else if (text.startsWith('use ')) {
                useStatements.push({
                    text,
                    line
                });
                declarationLines.useStatement = line + 1;
            } else if (text.startsWith('class ')) {
                declarationLines.class = line + 1;
            } else {
                continue;
            }
        }

        if (pickedNamespace === null) {
            return useStatements;
        }

        return [useStatements, declarationLines];
    }

    getInsertLine(declarationLines) {
        let prepend = '\n';
        let append = '\n';
        let insertLine = null;

        if (declarationLines.useStatement !== null) {
            prepend = ''; // There is no use statements so don't prepend new line
            insertLine = declarationLines.useStatement;
        } else if (declarationLines.namespace !== null) {
            insertLine = declarationLines.namespace;

            if ((declarationLines.class - declarationLines.namespace) <= 1) {
                append = '\n\n'; // There is no line between namespace and class declaration so append 2 new line
            }
        } else {
            insertLine = declarationLines.PHPTag;

            if ((declarationLines.class - declarationLines.PHPTag) <= 1) {
                append = '\n\n'; // There is no line between php tag and class declaration so append 2 new line
            }
        }

        return [prepend, append, insertLine];
    }

    resolving() {
        let wordRange = this.getWordRange();
        
        if (wordRange === undefined) {
            return null;
        }

        return editor.document.getText(wordRange);
    }

    getWordRange() {
        return vscode.workspace.textDocuments[0].getWordRangeAtPosition(
            editor.selection.active
        );
    }

    showMessage(message, error = false) {
        if (config.get('messagesOnStatusBar', false)) {
            return vscode.window.setStatusBarMessage(message, 3000);
        } else {
            message = message.replace(/\$\(.+?\)\s\s/, '');
        }

        let notifier = vscode.window.showInformationMessage;

        if (error) {
            notifier = vscode.window.showErrorMessage;
        }

        notifier(message);
    }
}

function activate(context) {
    let resolver = new Resolver();

    let importNamespace = vscode.commands.registerCommand('namespaceResolver.import', () => resolver.importNamespace());
    let expandNamespace = vscode.commands.registerCommand('namespaceResolver.expand', () => resolver.expandNamespace());
    let sortNamespaces = vscode.commands.registerCommand('namespaceResolver.sort', () => resolver.sortNamespaces());

    context.subscriptions.push(importNamespace);
    context.subscriptions.push(expandNamespace);
    context.subscriptions.push(sortNamespaces);
    context.subscriptions.push(resolver);
}

exports.activate = activate;
