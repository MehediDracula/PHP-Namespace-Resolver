# PHP Namespace Resolver

[![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/MehediDracula.php-namespace-resolver.svg
)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/MehediDracula.php-namespace-resolver.svg
)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver) [![Rating](https://vsmarketplacebadge.apphb.com/rating-short/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver#review-details)

PHP Namespace Resolver can import and expand your class. You can also sort your imported classes by line length or in alphabetical order.

## Demo

![](https://i.imgur.com/upEGtPa.gif)

## Commands

Search these commands by the title on command palette.

```javascript
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

## Settings

You can override these default settings according to your needs.

```javascript
{
    "namespaceResolver.exclude": "**/node_modules/**",  // Exclude glob pattern while finding files
    "namespaceResolver.showMessageOnStatusBar": false,  // Show message on status bar instead of notification box
    "namespaceResolver.autoSort": true,                 // Auto sort after imports
    "namespaceResolver.sortAlphabetically": false,      // Sort imports in alphabetical order instead of line length
    "namespaceResolver.leadingSeparator": true          // Expand class with leading namespace separator
}
```

## Keybindings

You can override these default keybindings on your `keybindings.json`.

```javascript
[
    {
        "command": "namespaceResolver.import",
        "key": "ctrl+alt+i",
        "when": "editorTextFocus"
    },
    {
        "command": "namespaceResolver.expand",
        "key": "ctrl+alt+e",
        "when": "editorTextFocus"
    },
    {
        "command": "namespaceResolver.sort",
        "key": "ctrl+alt+s",
        "when": "editorTextFocus"
    }
]
```

## Author

- [@MehediDracula](https://twitter.com/MehediDracula)

## License

[MIT](LICENSE) License.

Copyright (c) 2017 Mehedi Hassan
