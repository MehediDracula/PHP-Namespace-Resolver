<p align="center">
  <img src="images/banner.png" alt="PHP Namespace Resolver" />
</p>

# PHP Namespace Resolver

[![Version](https://vsmarketplacebadges.dev/version/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver)
[![Installs](https://vsmarketplacebadges.dev/installs-short/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver)
[![Rating](https://vsmarketplacebadges.dev/rating-short/MehediDracula.php-namespace-resolver.svg)](https://marketplace.visualstudio.com/items?itemName=MehediDracula.php-namespace-resolver)

Import, expand, sort, and manage PHP namespaces with full PHP 8+ support. Detects unimported and unused classes, offers quick fixes, and keeps your imports clean.

## Features

- **Import Class** — resolve and add `use` statements for any class
- **Import All Classes** — detect and import every unresolved class in one go
- **Expand Class** — replace a short class name with its fully qualified name inline
- **Sort Imports** — sort `use` statements by length, alphabetically, or with natural ordering; optionally insert a blank line between groups that differ in the first namespace segment (see `sortSeparateNamespaceGroups`)
- **Remove Unused Imports** — strip all unused `use` statements with one command
- **Generate Namespace** — generate a PSR-4/PSR-0 namespace from the file path and `composer.json`
- **Diagnostics** — unimported classes appear as warnings and unused imports as hints in the Problems panel
- **Quick Fixes** — lightbulb actions to import, expand, or remove directly from diagnostics
- **Namespace Caching** — persistent index with file watcher for fast resolution
- **Multi-Root Workspace** — file searching scoped to the correct workspace folder

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

You can override these defaults in your `keybindings.json`.

| Command | Windows / Linux | Mac |
|---------|-----------------|-----|
| Import Class | `Ctrl+Alt+I` | `⌃⌥I` |
| Import All Classes | `Ctrl+Alt+A` | `⌃⌥A` |
| Expand Class | `Ctrl+Alt+E` | `⌃⌥E` |
| Sort Imports | `Ctrl+Alt+S` | `⌃⌥S` |
| Remove Unused Imports | `Ctrl+Alt+R` | `⌃⌥R` |
| Generate Namespace | `Ctrl+Alt+G` | `⌃⌥G` |

## Settings

You can override these defaults in your VS Code settings.

```jsonc
{
    "phpNamespaceResolver.exclude": "**/node_modules/**",  // Glob pattern to exclude when searching files
    "phpNamespaceResolver.autoSort": true,                 // Auto sort after importing a class
    "phpNamespaceResolver.sortOnSave": false,              // Sort imports when a file is saved
    "phpNamespaceResolver.sortMode": "natural",            // Sort mode: "natural", "length", or "alphabetical"
    "phpNamespaceResolver.sortSeparateNamespaceGroups": false, // When true, blank line between adjacent uses whose FQCN root (first segment) differs; roots compared case-insensitively (e.g. App and app stay one group)
    "phpNamespaceResolver.leadingSeparator": true,         // Prepend leading backslash when expanding
    "phpNamespaceResolver.removeOnSave": false,            // Remove unused imports on save
    "phpNamespaceResolver.autoImportOnSave": false,        // Auto import all detected classes on save
    "phpNamespaceResolver.ignoreList": [],                 // Class names to exclude from diagnostics (e.g. ["Yii"])
    "phpNamespaceResolver.highlightNotImported": true,     // Show warnings for unimported classes
    "phpNamespaceResolver.highlightNotUsed": true          // Show hints for unused imports
}
```

`sortSeparateNamespaceGroups` applies per kind block (`use` classes, then `use function`, then `use const`). Grouped imports such as `use Foo\{A, B};` stay a single line, so spacing is unchanged inside that line.

## Running tests

From the repository root, after `npm install`:

| Command | What it runs |
|---------|----------------|
| `npm run compile` | TypeScript build (`out/`) |
| `npm run test:unit` | Mocha unit tests (`out/test/*.test.js`), no VS Code |
| `npm run test:integration` | Extension tests inside a downloaded VS Code instance (`@vscode/test-electron`) |
| `npm test` | Unit tests, then integration tests |
| `npm run lint` | ESLint on `src/` |

**Validate locally:** run `npm run compile && npm run test:unit && npm run lint`. Integration tests need a GUI-capable environment compatible with your installed `@vscode/test-electron` and VS Code build; if the Electron process fails to start, update dev dependencies or run tests in CI.

## Author

- [@MehediDracula](https://twitter.com/MehediDracula)

## License

[MIT](LICENSE) License.

Copyright (c) 2017 Mehedi Hasan
