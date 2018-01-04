# Change Log
All notable changes to the "php-namespace-resolver" extension will be documented in this file.

## [0.9.4] - 2018-01-04
### Added
- Add multi cursor support
- Import class directly if fqcn is selected

## [0.9.3] - 2018-01-04
### Added
- Check conflict for aliases also
- If class is not found then import class as global class
- Import class at the top of the file if php tag not found

## [0.9.2] - 2018-01-02
### Fixed
- Showing class on picker even if it has a namespace

## [0.9.0] - 2018-01-02
### Added
- Add support to find classes without namespaces
### Removed
- Remove context menus

## [0.8.0] - 2017-10-16
### Added
- Add support for expanding on multiple cursor
### Changed
- Check for namespace conflict case insensitively

## [0.7.9] - 2017-10-2
### Changed
- Clean up settings doc

## [0.7.8] - 2017-10-2
### Changed
- Show app namespace on top while choosing namespace to import

## [0.7.7] - 2017-09-30
### Added
- Added support for `interface` `abstract` `trait` keywords [#9](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/9)
- Added support for `final` keyword
### Changed
- Optimize performance [#10](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/10)

## [0.7.6] - 2017-09-06
### Changed
- Make alphabetic sort in case sensitive. [#2](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/2)
- Show error message instead of information if nothing to sort
- Bug fixes

## [0.7.4] - 2017-09-01
### Changed
- Move context menu to a separate group

## [0.7.3] - 2017-09-01
### Changed
- Activate context menu only on PHP language

## [0.7.0] - 2017-09-01
### Changed
- Change default keybindings

## [0.6.0] - 2017-08-29
### Added
- Add configuration to exclude files
- If a class with the same name is already imported prompt for an alias

### Changed
- Rename command titles
- Rename `messagesOnStatusBar` configuration to `showMessageOnStatusBar`
- Show error message instead of info if the class is already imported
