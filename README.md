# PHP Namespace Resolver

PHP Namespace Resolver can import, expand and sort your namespaces.

# Install

Press <kbd>ctrl+p</kbd> in VS Code, then type `ext install php-namespace-resolver`

## Demo

![](https://i.imgur.com/upEGtPa.gif)

## Commands

Search these commands by the title on command palette.

```json
[
    {
        "title": "Import Class",
        "command": "namespaceResolver.import"
    },
    {
        "title": "Expand Class",
        "command": "namespaceResolver.expand"
    },
    {
        "title": "Sort Imports",
        "command": "namespaceResolver.sort"
    }
]
```

## Keybindings

You can override these default keybindings on your `keybindings.json`.

```json
[
    {
        "command": "namespaceResolver.import",
        "key": "f1",
        "when": "editorTextFocus"
    },
    {
        "command": "namespaceResolver.expand",
        "key": "f2",
        "when": "editorTextFocus"
    },
    {
        "command": "namespaceResolver.sort",
        "key": "f3",
        "when": "editorTextFocus"
    }
]
```

## Settings

```json
[
    "namespaceResolver.exclude": {
        "type": "string",
        "default": "**/node_modules/**",
        "description": "Exclude glob pattern while finding files."
    },
    "namespaceResolver.showMessageOnStatusBar": {
        "type": "boolean",
        "default": false,
        "description": "Show message on status bar instead of notification box."
    },
    "namespaceResolver.autoSort": {
        "type": "boolean",
        "default": true,
        "description": "Auto sort after imports."
    },
    "namespaceResolver.sortAlphabetically": {
        "type": "boolean",
        "default": false,
        "description": "Sort imports in alphabetical order instead of line length."
    },
    "namespaceResolver.leadingSeparator": {
        "type": "boolean",
        "default": true,
        "description": "Expand with leading namespace separator."
    }
]
```

## Context Menu

```json
[
    {
        "command": "namespaceResolver.import",
        "group": "1_modification"
    },
    {
        "command": "namespaceResolver.expand",
        "group": "1_modification"
    },
    {
        "command": "namespaceResolver.sort",
        "group": "1_modification"
    }
]
```

## Author

- [Mehedi Hassan](https://www.facebook.com/MehediDracula)
- [@MehediDracula](https://twitter.com/MehediDracula)

## License

[MIT](LICENSE) License.

Copyright (c) 2017 Mehedi Hassan
