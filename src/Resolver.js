let vscode = require('vscode');
let builtInClasses = require('./classes');
let naturalSort = require('node-natural-sort');

class Resolver {
    regexWordWithNamespace = new RegExp(/[a-zA-Z0-9\\]+/);

    async importCommand(selection) {
        let resolving = this.resolving(selection);

        if (resolving === undefined) {
            return this.showErrorMessage(`$(issue-opened)  No class is selected.`);
        }

        let fqcn;
        let replaceClassAfterImport = false;

        if (/\\/.test(resolving)) {
            fqcn = resolving.replace(/^\\?/, '');
            replaceClassAfterImport = true;
        } else {
            let files = await this.findFiles(resolving);
            let namespaces = await this.findNamespaces(resolving, files);

            fqcn = await this.pickClass(namespaces);
        }

        this.importClass(selection, fqcn, replaceClassAfterImport);
    }

    async importAll() {
        let text = this.activeEditor().document.getText();
        let phpClasses = this.getPhpClasses(text);
        let useStatements = this.getUseStatementsArray();

        for (let phpClass of phpClasses) {
            if (! useStatements.includes(phpClass)) {
                await this.importCommand(phpClass);
            }
        }
    }

    getPhpClasses(text) {
        let phpClasses = this.getExtended(text);

        phpClasses = phpClasses.concat(this.getFromFunctionParameters(text));
        phpClasses = phpClasses.concat(this.getInitializedWithNew(text));
        phpClasses = phpClasses.concat(this.getFromStaticCalls(text));
        phpClasses = phpClasses.concat(this.getFromInstanceofOperator(text));

        return phpClasses.filter((v, i, a) => a.indexOf(v) === i);
    }

    getExtended(text) {
        let regex = /extends ([A-Z][A-Za-z0-9\-\_]*)/gm;
        let matches = [];
        let phpClasses = [];

        while (matches = regex.exec(text)) {
            phpClasses.push(matches[1]);
        }

        return phpClasses;
    }

    getFromFunctionParameters(text) {
        let regex = /function [\S]+\((.*)\)/gm;
        let matches = [];
        let phpClasses = [];

        while (matches = regex.exec(text)) {
            let parameters = matches[1].split(', ');

            for (let s of parameters) {
                let phpClassName = s.substr(0, s.indexOf(' '));

                // Starts with capital letter
                if (phpClassName && /[A-Z]/.test(phpClassName[0])) {
                    phpClasses.push(phpClassName);
                }
            }
        }

        return phpClasses;
    }

    getInitializedWithNew(text) {
        let regex = /new ([A-Z][A-Za-z0-9\-\_]*)/gm;
        let matches = [];
        let phpClasses = [];

        while (matches = regex.exec(text)) {
            phpClasses.push(matches[1]);
        }

        return phpClasses;
    }

    getFromStaticCalls(text) {
        let regex = /([A-Z][A-Za-z0-9\-\_]*)::/gm;
        let matches = [];
        let phpClasses = [];

        while (matches = regex.exec(text)) {
            phpClasses.push(matches[1]);
        }

        return phpClasses;
    }

    getFromInstanceofOperator(text) {
        let regex = /instanceof ([A-Z_][A-Za-z0-9\_]*)/gm;
        let matches = [];
        let phpClasses = [];

        while (matches = regex.exec(text)) {
            phpClasses.push(matches[1]);
        }

        return phpClasses;
    }

    async highlightNotImported() {
        let text = this.activeEditor().document.getText();
        let phpClasses = this.getPhpClasses(text);
        let importedPhpClasses = this.getImportedPhpClasses(text);

        // Get phpClasses not present in importedPhpClasses
        let notImported = phpClasses.filter(function (phpClass) {
            return !importedPhpClasses.includes(phpClass);
        });

        // Highlight diff
        let matches = [];
        let decorationOptions = [];

        for (let i = 0; i < notImported.length; i++) {
            let regex = new RegExp(notImported[i], 'g');

            while (matches = regex.exec(text)) {
                let startPos = this.activeEditor().document.positionAt(matches.index);

                // as js does not support regex look behinds we get results
                // where the object name is in the middle of a string
                // we should drop those
                let textLine = this.activeEditor().document.lineAt(startPos);
                let charBeforeMatch = textLine.text.charAt(startPos.character - 1);

                if (!/\w/.test(charBeforeMatch) && textLine.text.search(/namespace/) == -1) {
                    let endPos = this.activeEditor().document.positionAt(matches.index + matches[0].length);

                    decorationOptions.push({
                        range: new vscode.Range(startPos, endPos),
                        hoverMessage: 'Class is not imported.',
                    });
                }
            }
        }

        // TODO have these in settings
        let decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,155,0, 0.5)',
            light: {
                borderColor: 'darkblue'
            },
            dark: {
                borderColor: 'lightblue'
            }
        });

        this.activeEditor().setDecorations(decorationType, decorationOptions);
    }

    async highlightNotUsed() {
        const text = this.activeEditor().document.getText();
        const phpClasses = this.getPhpClasses(text);
        const importedPhpClasses = this.getImportedPhpClasses(text);

        // Get phpClasses not present in importedPhpClasses
        let notUsed = importedPhpClasses.filter(function (phpClass) {
            return ! phpClasses.includes(phpClass);
        });

        // Highlight diff
        let matches = [];
        let decorationOptions = [];

        for (let i = 0; i < notUsed.length; i++) {
            let regex = new RegExp(notUsed[i], 'g');

            while (matches = regex.exec(text)) {
                let startPos = this.activeEditor().document.positionAt(matches.index);
                let textLine = this.activeEditor().document.lineAt(startPos);

                if (textLine.text.search(/use/) != -1) {
                    let endPos = this.activeEditor().document.positionAt(matches.index + matches[0].length);

                    decorationOptions.push({
                        range: new vscode.Range(startPos, endPos),
                        hoverMessage: 'Class is not used.',
                    });
                }
            }
        }

        // TODO have these in settings
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,55,55, 0.5)',
            light: {
                borderColor: 'darkblue'
            },
            dark: {
                borderColor: 'lightblue'
            }
        });

        this.activeEditor().setDecorations(decorationType, decorationOptions);
    }

    getImportedPhpClasses(text) {
        let regex = /use (.*);/gm;
        let matches = [];
        let importedPhpClasses = [];

        while (matches = regex.exec(text)) {
            let className = matches[1].split('\\').pop();

            importedPhpClasses.push(className);
        }

        return importedPhpClasses;
    }

    importClass(selection, fqcn, replaceClassAfterImport = false) {
        let useStatements, declarationLines;

        try {
            [useStatements, declarationLines] = this.getDeclarations(fqcn);
        } catch (error) {
            return this.showErrorMessage(error.message);
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
            this.showErrorMessage(`$(issue-opened)  This alias is already in use.`);

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

    async replaceNamespaceStatement(namespace, line) {
        let realLine = line - 1;
        let text = this.activeEditor().document.lineAt(realLine).text;
        let newNs = text.replace(/namespace (.+)/, namespace);

        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                new vscode.Range(realLine, 0, realLine, text.length),
                newNs.trim()
            );
        });
    }

    async importAndReplaceSelectedClass(selection, replacingClassName, fqcn, declarationLines, alias = null) {
        await this.changeSelectedClass(selection, replacingClassName, false);

        this.insert(fqcn, declarationLines, alias);
    }

    async expandCommand(selection) {
        let resolving = this.resolving(selection);

        if (resolving === null) {
            return this.showErrorMessage(`$(issue-opened)  No class is selected.`);
        }

        let files = await this.findFiles(resolving);
        let namespaces = await this.findNamespaces(resolving, files);
        let fqcn = await this.pickClass(namespaces);

        this.changeSelectedClass(selection, fqcn, true);
    }

    async changeSelectedClass(selection, fqcn, prependBackslash = false) {
        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                this.activeEditor().document.getWordRangeAtPosition(selection.active, this.regexWordWithNamespace),
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
            return this.showErrorMessage(error.message);
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
                    return this.showErrorMessage(`$(circle-slash)  The class is not found.`);
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

                    if (! parsedNamespaces.includes(fqcn)) {
                        parsedNamespaces.push(fqcn);
                        break;
                    }
                }
            }
        }

        // If selected text is a built-in php class add that at the beginning.
        if (builtInClasses.includes(resolving)) {
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

    getUseStatementsArray() {
        let useStatements = [];

        for (let line = 0; line < this.activeEditor().document.lineCount; line++) {
            let text = this.activeEditor().document.lineAt(line).text;

            if (text.startsWith('use ')) {
                useStatements.push(
                    text.match(/(\w+?);/)[1]
                );
            } else if (/(class|trait|interface)\s+\w+/.test(text)) {
                break;
            }
        }

        return useStatements;
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
        if ((typeof selection) == 'string') {
            return selection;
        }

        let wordRange = this.activeEditor().document.getWordRangeAtPosition(selection.active, this.regexWordWithNamespace);

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
            return vscode.window.setStatusBarMessage(message, 3000);
        }

        message = message.replace(/\$\(.+?\)\s\s/, '');

        if (error) {
            vscode.window.showErrorMessage(message);
        } else {
            vscode.window.showInformationMessage(message);
        }
    }

    showErrorMessage(message) {
        this.showMessage(message, true);
    }

    async generateNamespace() {
        let currentUri = this.activeEditor().document.uri;
        let currentFile = currentUri.path;
        let currentPath = currentFile.substr(0, currentFile.lastIndexOf('/'));
        
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(currentUri);

        if(workspaceFolder === undefined) {
            return this.showErrorMessage('No folder openned in workspace, cannot find composer.json');
        }

        //try to retrieve composer file by searching recursively into parent folders of the current file
        
        let composerFile;
        let composerPath = currentFile;

        do {
            composerPath = composerPath.substr(0, composerPath.lastIndexOf('/'));
            composerFile = await vscode.workspace.findFiles(new vscode.RelativePattern(composerPath, 'composer.json'));    
        } while (!composerFile.length && composerPath !== workspaceFolder.uri.path)


        if (! composerFile.length) {
            return this.showErrorMessage('No composer.json file found, automatic namespace generation failed');
        }

        composerFile = composerFile.pop().path;

        vscode.workspace.openTextDocument(composerFile).then((document) => {
            let composerJson = JSON.parse(document.getText());
            let psr4 = (composerJson.autoload || {})['psr-4'];

            if (psr4 === undefined) {
                return this.showErrorMessage('No psr-4 key in composer.json autoload object, automatic namespace generation failed');
            }

            let devPsr4 = (composerJson['autoload-dev'] || {})['psr-4'];

            if (devPsr4 !== undefined) {
                psr4 = {...psr4, ...devPsr4};
            }
            
            let currentRelativePath = currentPath.split(composerPath)[1];

            //this is a way to always match with psr-4 entries
            if(!currentRelativePath.endsWith('/')) {
                currentRelativePath += '/';
            }

            let namespaceBase = Object.keys(psr4).filter(function (namespaceBase) {
                return currentRelativePath.lastIndexOf(psr4[namespaceBase]) !== -1;
            })[0];

            let baseDir = psr4[namespaceBase];

            namespaceBase = namespaceBase.replace(/\\$/, '');

            let namespace = currentPath.substring(currentPath.lastIndexOf(baseDir)+baseDir.length);

            if (namespace !== "") {
                namespace = namespace.replace(/\//g, '\\');
                namespace = namespace.replace(/^\\/, '');
                namespace = namespace.replace(/\\$/, '');
                namespace = namespaceBase + '\\' + namespace;
            } else {
                namespace = namespaceBase;
            }

            namespace = 'namespace ' + namespace + ';' + "\n"

            let declarationLines;

            try {
                [, declarationLines] = this.getDeclarations();
            } catch (error) {
                return this.showErrorMessage(error.message);
            }

            if (declarationLines.namespace !== null) {
                this.replaceNamespaceStatement(namespace, declarationLines.namespace);
            } else {
                this.activeEditor().edit(textEdit => {
                    textEdit.insert(new vscode.Position(1, 0), namespace);
                });
            }
        });
    }
}

module.exports = Resolver;