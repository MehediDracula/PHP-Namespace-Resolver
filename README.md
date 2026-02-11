# PHP Namespace Resolver

[![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/MehediDracula.php-namespace-resolver.svg
)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/MehediDracula.php-namespace-resolver.svg
)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver) [![Rating](https://vsmarketplacebadge.apphb.com/rating-short/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver#review-details)

Import, expand, sort, and manage PHP namespaces with full PHP 8+ support. Detects unimported and unused classes, offers quick fixes, and keeps your imports clean.

## Features

- **Import Class** — resolve and add `use` statements for any class
- **Import All Classes** — detect and import every unresolved class in one go
- **Expand Class** — replace a short class name with its fully qualified name inline
- **Sort Imports** — sort `use` statements by length, alphabetically, or with natural ordering
- **Remove Unused Imports** — strip all unused `use` statements with one command
- **Generate Namespace** — generate a PSR-4/PSR-0 namespace from the file path and `composer.json`
- **Diagnostics** — unimported classes appear as warnings and unused imports as hints in the Problems panel
- **Quick Fixes** — lightbulb actions to import, expand, or remove directly from diagnostics
- **Namespace Caching** — in-memory index with file watcher for fast resolution
- **Multi-Root Workspace** — file searching scoped to the correct workspace folder

### PHP 8+ Support

Union types, intersection types, return types, typed properties, constructor promotion, nullable types, attributes, catch block types, and enum declarations are all detected and resolved.

## Demo

![](https://i.imgur.com/upEGtPa.gif)

## Commands

Search these commands by the title on command palette.

| Command | Title |
|---------|-------|
| `namespaceResolver.import` | Import Class |
| `namespaceResolver.importAll` | Import All Classes |
| `namespaceResolver.expand` | Expand Class |
| `namespaceResolver.sort` | Sort Imports |
| `namespaceResolver.removeUnused` | Remove Unused Imports |
| `namespaceResolver.generateNamespace` | Generate Namespace |
| `namespaceResolver.rebuildIndex` | Rebuild Namespace Index |

## Keybindings

You can override these defaults in your `keybindings.json`.

| Shortcut | Command |
|----------|---------|
| `Ctrl+Alt+I` | Import Class |
| `Ctrl+Alt+A` | Import All Classes |
| `Ctrl+Alt+E` | Expand Class |
| `Ctrl+Alt+S` | Sort Imports |
| `Ctrl+Alt+R` | Remove Unused Imports |
| `Ctrl+Alt+G` | Generate Namespace |

## Settings

You can override these defaults in your VS Code settings.

```jsonc
{
    "namespaceResolver.exclude": "**/node_modules/**",  // Glob pattern to exclude when searching files
    "namespaceResolver.autoSort": true,                 // Auto sort after importing a class
    "namespaceResolver.sortOnSave": false,              // Sort imports when a file is saved
    "namespaceResolver.sortAlphabetically": false,      // Sort alphabetically instead of by line length
    "namespaceResolver.sortNatural": false,             // Sort using natural order algorithm
    "namespaceResolver.leadingSeparator": true,         // Prepend leading backslash when expanding
    "namespaceResolver.removeOnSave": false,            // Remove unused imports on save
    "namespaceResolver.autoImportOnSave": false         // Auto import all detected classes on save
}
```

## Author

- [@MehediDracula](https://twitter.com/MehediDracula)

## License

[MIT](LICENSE) License.

Copyright (c) 2017 Mehedi Hassan
