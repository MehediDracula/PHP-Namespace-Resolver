let vscode = require('vscode');
let builtInClasses = require('./classes');
let naturalSort = require('node-natural-sort');

class Resolver {
    async importCommand(selection) {
        let resolving = this.resolving(selection);

        if (resolving === undefined) {
            this.showMessage(`$(issue-opened)  No class is selected.`, true);
            return;
        }

        let fqcn;
        let replaceClassAfterImport = false;

        if (/\\/.test(resolving)) {
            fqcn = resolving;
            replaceClassAfterImport = true;
        } else {
            let files = await this.findFiles(resolving);
            let namespaces = await this.findNamespaces(resolving, files);

            fqcn = await this.pickClass(namespaces);
        }

        this.importClass(selection, fqcn, replaceClassAfterImport);
    }

    importClass(selection, fqcn, replaceClassAfterImport = false) {
        let useStatements, declarationLines;

        try {
            [useStatements, declarationLines] = this.getDeclarations(fqcn);
        } catch (error) {
            this.showMessage(error.message, true);
            return;
        }

        let classBaseName = fqcn.match(/(\w+)/g).pop();

        if (this.hasConflict(useStatements, classBaseName)) {
            this.insertAsAlias(selection, fqcn, useStatements, declarationLines);
        } else if (replaceClassAfterImport) {
            this.importAndReplaceSelectedClass(selection, classBaseName, fqcn, declarationLines);
        } else {
            this.insert(fqcn, declarationLines);
        }
    }

    async insert(fqcn, declarationLines, alias = null) {
        let [prepend, append, insertLine] = this.getInsertLine(declarationLines);

        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                new vscode.Position((insertLine), 0),
                (`${prepend}use ${fqcn}`) + (alias !== null ? ` as ${alias}` : '') + (`;${append}`)
            );
        });

        if (this.config('autoSort')) {
            this.sortImports();
        }

        this.showMessage('$(check)  The class is imported.');
    }

    async insertAsAlias(selection, fqcn, useStatements, declarationLines) {
        let alias = await vscode.window.showInputBox({
            placeHolder: 'Enter an alias or leave it empty to replace'
        });

        if (alias === undefined) {
            return;
        }

        if (this.hasConflict(useStatements, alias)) {
            vscode.window.setStatusBarMessage(`$(issue-opened)  This alias is already in use.`, 3000)

            this.insertAsAlias(selection, fqcn, useStatements, declarationLines)
        } else if (alias !== '') {
            this.importAndReplaceSelectedClass(selection, alias, fqcn, declarationLines, alias);
        } else if (alias === '') {
            this.replaceUseStatement(fqcn, useStatements);
        }
    }

    async replaceUseStatement(fqcn, useStatements) {
        let useStatement = useStatements.find(use => {
            let className = use.text.match(/(\w+)?;/).pop();

            return fqcn.endsWith(className);
        });

        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                new vscode.Range(useStatement.line, 0, useStatement.line, useStatement.text.length),
                `use ${fqcn};`
            );
        });

        if (this.config('autoSort')) {
            this.sortImports();
        }
    }

    async importAndReplaceSelectedClass(selection, replacingClassName, fqcn, declarationLines, alias = null) {
        await this.changeSelectedClass(selection, replacingClassName, false);

        this.insert(fqcn, declarationLines, alias);
    }

    async expandCommand(selection) {
        let resolving = this.resolving(selection);

        if (resolving === null) {
            this.showMessage(`$(issue-opened)  No class is selected.`, true);
            return;
        }

        let files = await this.findFiles(resolving);
        let namespaces = await this.findNamespaces(resolving, files);
        let fqcn = await this.pickClass(namespaces);

        this.changeSelectedClass(selection, fqcn, true);
    }

    async changeSelectedClass(selection, fqcn, prependBackslash = false) {
        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                this.activeEditor().document.getWordRangeAtPosition(selection.active),
                (prependBackslash && this.config('leadingSeparator') ? '\\' : '') + fqcn
            );
        });

        let newPosition = new vscode.Position(selection.active.line, selection.active.character);

        this.activeEditor().selection = new vscode.Selection(newPosition, newPosition);
    }

    sortCommand() {
        try {
            this.sortImports();
        } catch (error) {
            this.showMessage(error.message, true);
            return;
        }

        this.showMessage('$(check)  Imports are sorted.');
    }

    findFiles(resolving) {
        return vscode.workspace.findFiles(`**/${resolving}.php`, this.config('exclude'));
    }

    findNamespaces(resolving, files) {
        return new Promise((resolve, reject) => {
            let textDocuments = this.getTextDocuments(files, resolving);

            Promise.all(textDocuments).then(docs => {
                let parsedNamespaces = this.parseNamespaces(docs, resolving);

                if (parsedNamespaces.length === 0) {
                    this.showMessage(`$(circle-slash)  The class is not found.`, true);
                    return;
                }

                resolve(parsedNamespaces);
            });
        });
    }

    pickClass(namespaces) {
        return new Promise((resolve, reject) => {
            if (namespaces.length === 1) {
                // Only one namespace found so no need to show picker.
                return resolve(namespaces[0]);
            }

            vscode.window.showQuickPick(namespaces).then(picked => {
                if (picked !== undefined) {
                    resolve(picked);
                }
            });
        })
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

                if (textLine.startsWith('namespace ') || textLine.startsWith('<?php namespace ')) {
                    let namespace = textLine.match(/^(namespace|(<\?php namespace))\s+(.+)?;/).pop();
                    let fqcn = `${namespace}\\${resolving}`;

                    if (parsedNamespaces.indexOf(fqcn) === -1) {
                        parsedNamespaces.push(fqcn);
                        break;
                    }
                }
            }
        }

        // If selected text is a built-in php class add that at the beginning.
        if (builtInClasses.indexOf(resolving) !== -1) {
            parsedNamespaces.unshift(resolving);
        }

        // If namespace can't be parsed but there is a file with the same
        // name of selected text then assuming it's a global class and
        // add that in the parsedNamespaces array as a global class.
        if (parsedNamespaces.length === 0 && docs.length > 0) {
            parsedNamespaces.push(resolving);
        }

        return parsedNamespaces;
    }

    sortImports() {
        let [useStatements,] = this.getDeclarations();

        if (useStatements.length <= 1) {
            throw new Error('$(issue-opened)  Nothing to sort.');
            return;
        }

        let sortFunction = (a, b) => {
            if (this.config('sortAlphabetically')) {
                if (a.text.toLowerCase() < b.text.toLowerCase()) return -1;
                if (a.text.toLowerCase() > b.text.toLowerCase()) return 1;
                return 0;
            } else {
                if (a.text.length == b.text.length) {
                    if (a.text.toLowerCase() < b.text.toLowerCase()) return -1;
                    if (a.text.toLowerCase() > b.text.toLowerCase()) return 1;
                }
                return a.text.length - b.text.length;
            }
        }

        if (this.config('sortNatural')) {
            let natsort = naturalSort({
                caseSensitive: true,
                order: this.config('sortAlphabetically') ? 'ASC' : 'DESC'
            });
            sortFunction = (a, b) => {
                return natsort(a.text, b.text);
            };
        }

        let sorted = useStatements.slice().sort(sortFunction);

        this.activeEditor().edit(textEdit => {
            for (let i = 0; i < sorted.length; i++) {
                textEdit.replace(
                    new vscode.Range(useStatements[i].line, 0, useStatements[i].line, useStatements[i].text.length),
                    sorted[i].text
                );
            }
        });
    }

    activeEditor() {
        return vscode.window.activeTextEditor;
    }

    hasConflict(useStatements, resolving) {
        for (let i = 0; i < useStatements.length; i++) {
            if (useStatements[i].text.match(/(\w+)?;/).pop() === resolving) {
                return true;
            }
        }

        return false;
    }

    getDeclarations(pickedClass = null) {
        let useStatements = [];
        let declarationLines = {
            PHPTag: 0,
            namespace: null,
            useStatement: null,
            class: null
        };

        for (let line = 0; line < this.activeEditor().document.lineCount; line++) {
            let text = this.activeEditor().document.lineAt(line).text;

            if (pickedClass !== null && text === `use ${pickedClass};`) {
                throw new Error('$(issue-opened)  The class is already imported.');
            }

            // break if all declarations were found.
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
            } else if (/(class|trait|interface)\s+\w+/.test(text)) {
                declarationLines.class = line + 1;
            } else {
                continue;
            }
        }

        return [useStatements, declarationLines];
    }

    getInsertLine(declarationLines) {
        let prepend = declarationLines.PHPTag === 0 ? '' : '\n';
        let append = '\n';
        let insertLine = declarationLines.PHPTag;

        if (prepend === '' && declarationLines.namespace !== null) {
            prepend = '\n';
        }

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

    resolving(selection) {
        let wordRange = this.activeEditor().document.getWordRangeAtPosition(selection.active);

        if (wordRange === undefined) {
            return;
        }

        return this.activeEditor().document.getText(wordRange);
    }

    config(key) {
        return vscode.workspace.getConfiguration('namespaceResolver').get(key);
    }

    showMessage(message, error = false) {
        if (this.config('showMessageOnStatusBar')) {
            vscode.window.setStatusBarMessage(message, 3000);
            return;
        }

        message = message.replace(/\$\(.+?\)\s\s/, '');

        if (error) {
            vscode.window.showErrorMessage(message);
        } else {
            vscode.window.showInformationMessage(message);
        }
    }
}

module.exports = Resolver;
