# Feature Suggestions for PHP Namespace Resolver

## 1. PHP 8+ Language Support

The current regex-based class detection misses several modern PHP constructs introduced in PHP 8.0, 8.1, 8.2, and 8.3.

### Union and Intersection Types (PHP 8.0 / 8.1)

```php
// Not currently detected:
function handle(Request|Response $input): void {}
function process(Countable&Iterator $collection): void {}
```

The `getFromFunctionParameters` method in `Resolver.js` uses a single-match regex that doesn't account for `|` or `&` type separators. Each type in a union/intersection should be individually resolved and imported.

### Enum Support (PHP 8.1)

```php
// Enum backed types and implements are not detected:
enum Status: string implements HasLabel {}
```

Add detection for `enum` declarations and their `implements` clauses.

### Return Type Declarations

```php
// Return types are not currently detected:
function getUser(): User {}
function findAll(): Collection {}
```

Add a `getFromReturnTypes(text)` method to scan for return type hints after `):`

### Constructor Promotion and Property Types (PHP 8.0+)

```php
// Promoted constructor properties:
public function __construct(
    private readonly UserRepository $repo,
    protected Logger $logger,
) {}

// Typed properties:
private UserService $service;
```

Add detection for typed class properties and promoted constructor parameters.

### Attribute Classes (PHP 8.0)

```php
#[Route('/api/users', methods: ['GET'])]
#[ORM\Entity(repositoryClass: UserRepository::class)]
```

Add a `getFromAttributes(text)` method to detect classes used in `#[...]` attribute syntax.

### Catch Block Types

```php
catch (NotFoundException | AuthorizationException $e) {}
```

Add a `getFromCatchBlocks(text)` method to detect exception types.

---

## 2. Remove Unused Imports Command

The extension can *highlight* unused imports but cannot *remove* them. A natural companion to `highlightNotUsed` would be a `removeUnused` command that deletes all unused `use` statements in one action.

**Suggested implementation:**
- New command: `namespaceResolver.removeUnused`
- Keybinding: `Ctrl+Alt+R`
- Option: `removeOnSave` (boolean, default `false`) to automatically strip unused imports on save
- Should clean up blank lines left behind after removal

---

## 3. Configurable Highlight Colors

There are two TODO comments in `Resolver.js` (lines ~160 and ~206) noting that decoration colors should be configurable. Currently the highlight colors are hardcoded:

- Not imported: `rgba(255, 155, 0, 0.5)` (orange)
- Not used: `rgba(255, 0, 0, 0.5)` (red)

**Suggested settings:**

```json
{
  "namespaceResolver.highlightNotImportedColor": "rgba(255, 155, 0, 0.5)",
  "namespaceResolver.highlightNotUsedColor": "rgba(255, 0, 0, 0.5)"
}
```

This would also resolve both existing TODO items in the codebase.

---

## 4. Diagnostics Panel Integration

The current highlight feature uses text decorations, which are visual-only. Integrating with VS Code's Diagnostics API (`vscode.languages.createDiagnosticCollection`) would surface unimported/unused classes in the **Problems** panel alongside other linter output.

**Benefits:**
- Problems persist across file switches (decorations disappear)
- Users can navigate errors with `F8` / `Shift+F8`
- Integrates with CI tools that read VS Code diagnostics
- Can assign severity levels (Warning for unused, Error for unimported)

---

## 5. Code Actions (Quick Fixes)

Register a `CodeActionProvider` so that when the cursor is on an unresolved class name, a lightbulb appears offering:

- **Import Class** - adds the `use` statement
- **Expand to FQCN** - replaces inline with the fully qualified name
- **Add alias** - imports with an alias

This follows the pattern established by other language extensions (TypeScript, Java, C#) and makes the extension discoverable without memorizing keybindings.

---

## 6. Automated Test Suite

The project has zero tests. Adding a test framework would improve reliability and enable confident refactoring.

**Suggested approach:**
- Use VS Code's `@vscode/test-electron` runner for integration tests
- Add unit tests for regex-based detection methods (these are pure functions and easy to test)
- Key areas to cover:
  - Class detection from various PHP patterns
  - Namespace parsing from file contents
  - Sort algorithm correctness
  - Import insertion point calculation
  - Conflict detection logic
  - Composer.json PSR-4 namespace resolution

---

## 7. Performance: Namespace Caching

Every import/expand operation re-searches the entire workspace with `findFiles()` and re-reads matching documents. For large projects this is slow.

**Suggested approach:**
- Build and maintain an in-memory namespace index on activation
- Use a `FileSystemWatcher` to incrementally update the index when files change
- Fall back to full search only when the cache is cold
- Add a manual refresh command: `namespaceResolver.rebuildIndex`

This would make import resolution near-instant for repeat operations.

---

## 8. Multi-Root Workspace Support

The extension uses `vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)` in `generateNamespace` but uses the global workspace for file searching. In multi-root workspaces, this can produce incorrect results by finding classes from unrelated projects.

**Suggested fix:**
- Scope `findFiles` to the workspace folder containing the active file
- Search `composer.json` within the correct root
- Allow per-folder configuration overrides

---

## 9. Group and Organize Imports

PHP supports grouped imports:

```php
use App\Models\{User, Post, Comment};
```

**Feature options:**
- A command to collapse individual imports into grouped form
- A command to expand grouped imports into individual statements
- A setting to choose preferred style when importing
- Sort within groups

---

## 10. PSR-0 Autoload Support

The `generateNamespace` command only reads `psr-4` from `composer.json`. Some legacy projects still use PSR-0 autoloading, and the `classmap` and `files` sections are also ignored.

Adding PSR-0 support would make the extension usable for a wider range of PHP projects.

---

## Summary Table

| # | Feature | Impact | Complexity |
|---|---------|--------|------------|
| 1 | PHP 8+ language support | High | Medium |
| 2 | Remove unused imports | High | Low |
| 3 | Configurable highlight colors | Low | Low |
| 4 | Diagnostics panel integration | Medium | Medium |
| 5 | Code actions (quick fixes) | High | Medium |
| 6 | Automated test suite | High | Medium |
| 7 | Namespace caching | Medium | High |
| 8 | Multi-root workspace support | Medium | Low |
| 9 | Group/organize imports | Low | Medium |
| 10 | PSR-0 support | Low | Low |
