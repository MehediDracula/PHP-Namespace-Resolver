<p align="center">
  <img src="images/banner.png" alt="PHP Namespace Resolver" />
</p>

# PHP Namespace Resolver

[![Version](https://vsmarketplacebadges.dev/version/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver)
[![Installs](https://vsmarketplacebadges.dev/installs-short/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver)
[![Rating](https://vsmarketplacebadges.dev/rating-short/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver)

Import, expand, sort, and manage PHP namespaces with full PHP 8+ support. Detects unimported and unused classes, offers quick fixes, and keeps your imports clean.

## Features

* **Import Class** — resolve and add `use` statements for any class
* **Import All Classes** — detect and import every unresolved class in one go
* **Expand Class** — replace a short class name with its fully qualified name inline
* **Sort Imports** — sort `use` statements by length, alphabetically, or with natural ordering
* **Remove Unused Imports** — strip all unused `use` statements with one command
* **Generate Namespace** — generate a PSR-4/PSR-0 namespace from the file path and `composer.json`
* **Configurable Namespace Case** — customize generated namespace casing for directory segments while preserving the base namespace from `composer.json`
* **Diagnostics** — unimported classes appear as warnings and unused imports as hints in the Problems panel
* **Quick Fixes** — lightbulb actions to import, expand, or remove directly from diagnostics
* **Namespace Caching** — persistent index with file watcher for fast resolution
* **Multi-Root Workspace** — file searching scoped to the correct workspace folder

### PHP 8+ Support

Union types, intersection types, return types, typed properties, constructor promotion, nullable types, attributes, catch block types, and enum declarations are all detected and resolved.

## Demo

![](https://i.imgur.com/upEGtPa.gif)

## Commands

Search these commands by the title on command palette.

| Command | Title |
|---------|-------|
| `phpNamespaceResolver.import` | Import Class |
| `phpNamespaceResolver.importAll` | Import All Classes |
| `phpNamespaceResolver.expand` | Expand Class |
| `phpNamespaceResolver.sort` | Sort Imports |
| `phpNamespaceResolver.removeUnused` | Remove Unused Imports |
| `phpNamespaceResolver.generateNamespace` | Generate Namespace |
| `phpNamespaceResolver.rebuildIndex` | Rebuild Namespace Index |

## Keybindings

You can override these defaults in your `keybindings.json` .

| Command | Windows / Linux | Mac |
|---------|-----------------|-----|
| Import Class | `Ctrl+Alt+I` | `⌃⌥I` |
| Import All Classes | `Ctrl+Alt+A` | `⌃⌥A` |
| Expand Class | `Ctrl+Alt+E` | `⌃⌥E` |
| Sort Imports | `Ctrl+Alt+S` | `⌃⌥S` |
| Remove Unused Imports | `Ctrl+Alt+R` | `⌃⌥R` |
| Generate Namespace | `Ctrl+Alt+G` | `⌃⌥G` |

## Namespace Case

The `namespaceCase` setting controls the casing of namespace segments generated from directory names when using **Generate Namespace**.

The base namespace defined in `composer.json` is preserved, and only namespace segments generated from directory paths are affected.

Example project structure:

```
src/
└── Kernel/
    └── Contracts/
        └── RuntimeManager.php
```

Composer PSR-4 configuration:

```json
{
    "autoload": {
        "psr-4": {
            "App\\": "src/"
        }
    }
}
```

Generated namespaces:

| Value | Example |
|-------|---------|
| `original` | `App\Kernel\Contracts\RuntimeManager` |
| `pascal` | `App\Kernel\Contracts\RuntimeManager` |
| `camel` | `App\kernel\contracts\runtimeManager` |
| `lower` | `App\kernel\contracts\runtimemanager` |
| `upper` | `App\KERNEL\CONTRACTS\RUNTIMEMANAGER` |

Available values:

| Value | Description |
|-------|-------------|
| `original` | Keep directory names unchanged |
| `pascal` | Convert namespace segments to PascalCase |
| `camel` | Convert namespace segments to camelCase |
| `lower` | Convert namespace segments to lowercase |
| `upper` | Convert namespace segments to uppercase |

## Settings

You can override these defaults in your VS Code settings.

```jsonc
{
    "phpNamespaceResolver.exclude": "**/node_modules/**",  // Glob pattern to exclude when searching files
    "phpNamespaceResolver.autoSort": true,                 // Auto sort after importing a class
    "phpNamespaceResolver.sortOnSave": false,              // Sort imports when a file is saved
    "phpNamespaceResolver.sortMode": "natural",            // Sort mode: "natural", "length", or "alphabetical"
    "phpNamespaceResolver.leadingSeparator": true,         // Prepend leading backslash when expanding
    "phpNamespaceResolver.removeOnSave": false,            // Remove unused imports on save
    "phpNamespaceResolver.autoImportOnSave": false,        // Auto import all detected classes on save
    "phpNamespaceResolver.ignoreList": [],                 // Class names to exclude from diagnostics (e.g. ["Yii"])
    "phpNamespaceResolver.highlightNotImported": true,     // Show warnings for unimported classes
    "phpNamespaceResolver.highlightNotUsed": true,         // Show hints for unused imports
    "phpNamespaceResolver.namespaceCase": "original"       // Namespace casing: "original", "pascal", "camel", "lower", or "upper"
}
```

## Fork Information

This project is a fork of
[PHP Namespace Resolver](https://github.com/MehediDracula/PHP-Namespace-Resolver)
created by **Mehedi Hasan**.

Original project author:
* Mehedi Hasan (@MehediDracula)

This fork adds:

* Configurable namespace casing support
* Namespace generation options:
  + `original`
  + `pascal`
  + `camel`
  + `lower`
  + `upper`

All original credits and license terms are preserved.

## Contributors

Additional feature contributed:

* **Configurable Namespace Case**
* Contributor: [@kakhky](https://github.com/kakhky)

## Author

* [@MehediDracula](https://twitter.com/MehediDracula)

## License

[MIT](LICENSE) License.

Copyright (c) 2017 Mehedi Hasan
