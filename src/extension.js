let vscode = require('vscode');

class Resolver {
    importClass() {
        let activeEditor = this.activeEditor();
        let resolving = this.resolving(activeEditor);

        if (resolving === null) {
            return this.showMessage(`$(issue-opened)  No class is selected.`, true);
        }

        this.findFiles()
            .then(files => this.findNamespaces(activeEditor, resolving, files))
            .then(namespaces => this.pickClass(namespaces))
            .then(pickedClass => {
                let useStatements, declarationLines;

                try {
                    [useStatements, declarationLines] = this.getDeclarations(activeEditor, pickedClass);
                } catch (error) {
                    return this.showMessage(error.message, true);
                }

                if (! this.hasConflict(useStatements, resolving)) {
                    return this.insert(activeEditor, pickedClass, declarationLines);
                }

                vscode.window.showInputBox({
                    placeHolder: 'Enter an alias'
                }).then(alias => {
                    if (alias !== undefined && alias !== '') {
                        this.insert(activeEditor, pickedClass, declarationLines, alias);
                    }
                });
            });
    }

    expandClass() {
        let activeEditor = this.activeEditor();
        let resolving = this.resolving(activeEditor);

        if (resolving === null) {
            return this.showMessage(`$(issue-opened)  No class is selected.`, true);
        }

        this.findFiles()
            .then(files => this.findNamespaces(activeEditor, resolving, files))
            .then(namespaces => this.pickClass(namespaces))
            .then(pickedClass => {
                activeEditor.edit(textEdit => {
                    let selections = activeEditor.selections;

                    for (let i = 0; i < selections.length; i++) {
                        textEdit.replace(
                            activeEditor.document.getWordRangeAtPosition(selections[i].active),
                            (this.config('leadingSeparator') ? '\\' : '') + pickedClass
                        );
                    }
                });
            });
    }

    sortImports() {
        try {
            this.sort(this.activeEditor());
        } catch (error) {
            return this.showMessage(error.message, true);
        }

        this.showMessage('$(check)  Imports sorted.');
    }

    findFiles() {
        return vscode.workspace.findFiles('**/*.php', this.config('exclude'));
    }

    findNamespaces(activeEditor, resolving, files) {
        return new Promise((resolve, reject) => {
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

    pickClass(namespaces) {
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

    insert(activeEditor, pickedClass, declarationLines, alias = null) {
        let [prepend, append, insertLine] = this.getInsertLine(declarationLines);

        activeEditor.edit(textEdit => {
            textEdit.replace(
                new vscode.Position((insertLine), 0),
                (`${prepend}use ${pickedClass}`) + (alias !== null ? ` as ${alias}` : '') + (`;${append}`)
            );
        });

        if (this.config('autoSort')) {
            activeEditor.document.save().then(() => {
                try {
                    this.sort(activeEditor);
                } catch (error) {
                    // I don't care. LOL
                }
            });
        }

        this.showMessage('$(check)  Class imported.');
    }

    getTextDocuments(files, resolving) {
        let textDocuments = [];

        for (let i = 0; i < files.length; i++) {
            let fileName = files[i].fsPath.replace(/^.*[\\\/]/, '').split('.')[0];

            if (fileName !== resolving) {
                continue;
            }

            textDocuments.push(vscode.workspace.openTextDocument(files[i]));
        }

        return textDocuments;
    }

    parseNamespaces(docs, resolving) {
        let parsedNamespaces = [];

        for (let i = 0; i < docs.length; i++) {
            for (let line = 0; line < docs[i].lineCount; line++) {
                let textLine = docs[i].lineAt(line).text;

                let namespace;

                if (textLine.startsWith('namespace ') || textLine.startsWith('<?php namespace ')) {
                    namespace = textLine.split('namespace ')[1].split(';')[0] + '\\' + resolving;
                } else if (textLine.startsWith('class ') || textLine.startsWith('<?php class ')) {
                    namespace = textLine.match(/class\s(\w+)/)[1];
                }

                if (namespace !== undefined && parsedNamespaces.indexOf(namespace) === -1) {
                    parsedNamespaces.push(namespace);
                    break;
                }
            }
        }

        return parsedNamespaces;
    }

    sort(activeEditor) {
        let useStatements = this.getDeclarations(activeEditor);

        if (useStatements.length <= 1) {
            throw new Error('$(issue-opened)  Nothing to sort.');
        }

        let sorted = useStatements.slice().sort((a, b) => {
            if (this.config('sortAlphabetically')) {
                if (a.text.toLowerCase() < b.text.toLowerCase()) return -1;
                if (a.text.toLowerCase() > b.text.toLowerCase()) return 1;
                return 0;
            } else {
                return a.text.length - b.text.length;
            }
        });

        activeEditor.edit(textEdit => {
            for (let i = 0; i < sorted.length; i++) {
                textEdit.replace(
                    new vscode.Range(useStatements[i].line, 0, useStatements[i].line, useStatements[i].text.length),
                    sorted[i].text
                );
            }
        });
    }

    hasConflict(useStatements, resolving) {
        for (let i = 0; i < useStatements.length; i++) {
            if (useStatements[i].text.toLowerCase().split(`\\${resolving.toLowerCase()};`).length === 2) {
                return true;
            }
        }

        return false;
    }

    getDeclarations(activeEditor, pickedClass = null) {
        let useStatements = [];
        let declarationLines = {
            PHPTag: null,
            namespace: null,
            useStatement: null,
            class: null
        };

        for (let line = 0; line < activeEditor.document.lineCount; line++) {
            let text = activeEditor.document.lineAt(line).text;

            if (pickedClass !== null && text === `use ${pickedClass};`) {
                throw new Error('$(issue-opened)  Class already imported.');
            }

            // break if all declarations were found
            if (declarationLines.PHPTag && declarationLines.namespace &&
                declarationLines.useStatement && declarationLines.class) {
                break;
            }

            if (text.startsWith('<?php')) {
                declarationLines.PHPTag = line + 1;
            } else if (text.startsWith('namespace ') || text.startsWith('<?php namespace')) {
                declarationLines.namespace = line + 1;
            } else if (text.startsWith('use ')) {
                useStatements.push({ text, line });
                declarationLines.useStatement = line + 1;
            } else if (text.startsWith('final ')
                || text.startsWith('abstract ')
                || text.startsWith('class ')
                || text.startsWith('trait ')
                || text.startsWith('interface ')
            ) {
                declarationLines.class = line + 1;
            } else {
                continue;
            }
        }

        if (declarationLines.PHPTag === null) {
            throw new Error('$(circle-slash)  Can not import class in this file.');
        }

        if (pickedClass === null) {
            return useStatements;
        }

        return [useStatements, declarationLines];
    }

    getInsertLine(declarationLines) {
        let prepend = '\n';
        let append = '\n';
        let insertLine = declarationLines.PHPTag;

        if (declarationLines.useStatement !== null) {
            prepend = '';
            insertLine = declarationLines.useStatement;
        } else if (declarationLines.namespace !== null) {
            insertLine = declarationLines.namespace;
        }

        if (declarationLines.class !== null &&
            ((declarationLines.class - declarationLines.useStatement) <= 1 ||
            (declarationLines.class - declarationLines.namespace) <= 1 ||
            (declarationLines.class - declarationLines.PHPTag) <= 1)
        ) {
            append = '\n\n';
        }

        return [prepend, append, insertLine];
    }

    activeEditor() {
        return vscode.window.activeTextEditor;
    }

    resolving(activeEditor) {
        let wordRange = activeEditor.document.getWordRangeAtPosition(activeEditor.selection.active);

        if (wordRange === undefined) {
            return null;
        }

        return activeEditor.document.getText(wordRange);
    }

    config(key) {
        return vscode.workspace.getConfiguration('namespaceResolver').get(key);
    }

    showMessage(message, error = false) {
        if (this.config('showMessageOnStatusBar')) {
            return vscode.window.setStatusBarMessage(message, 3000);
        }

        let notify = vscode.window.showInformationMessage;

        if (error) {
            notify = vscode.window.showErrorMessage;
        }

        notify(message.replace(/\$\(.+?\)\s\s/, ''));
    }
}

function activate(context) {
    let resolver = new Resolver();

    let importNamespace = vscode.commands.registerCommand('namespaceResolver.import', () => resolver.importClass());
    let expandNamespace = vscode.commands.registerCommand('namespaceResolver.expand', () => resolver.expandClass());
    let sortNamespaces = vscode.commands.registerCommand('namespaceResolver.sort', () => resolver.sortImports());

    context.subscriptions.push(importNamespace);
    context.subscriptions.push(expandNamespace);
    context.subscriptions.push(sortNamespaces);
    context.subscriptions.push(resolver);
}

exports.activate = activate;
