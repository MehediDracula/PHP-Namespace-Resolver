# Change Log
All notable changes to the "php-namespace-resolver" extension will be documented in this file.

## [1.1.8] - 2019-05-13
### Fixed
- Cannot read property 'document' of undefined [#61](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/#61)

## [1.1.7] - 2019-03-18
### Added
- Support multiple autoload paths for namespace generation [#54](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/#54)

## [1.1.6] - 2019-03-13
### Changed
- Replace namespace if already present in file while generating namespace [#50](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/#50)

## [1.1.5] - 2019-01-29
### Fixed
- Trail only the latest double backslash in namespaceBase [#48](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/#48)
- Support windows path [#47](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/#47)

## [1.1.4] - 2019-01-29
### Added
- Auto highlight settings added [#43](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/43)

## [1.1.3] - 2019-01-25
### Added
- Add a new `Generate namespace for this file` command [#42](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/42)

## [1.1.2] - 2019-01-18
### Added
- Add a new `Highlight Not Imported Classes` command [#38](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/38)
- Add a new `Highlight Not Used Classes` command [#39](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/39)

## [1.1.1] - 2019-01-11
### Added
- Add a new `Import All Classes` command [#36](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/36)

## [1.1.0] - 2018-06-24
### Changed
- Adjust words

## [1.0.9] - 2018-05-21
### Added
- Add natural sorting option [#29](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/29)

## [1.0.7] - 2018-05-10
### Added
- New config for auto sorting when a file is saved

## [1.0.6] - 2018-04-26
### Fixed
- Escaping from alias import box not working
- No class is selected warning is not showing

## [1.0.5] - 2018-03-24
### Changed
- Don't move cursor after expanding class
- Don't wait before autosorting and replacing selected class

## [1.0.3] - 2018-03-24
### Fixed
- Add alphabetical fallback when imports are the same length [#25](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/25)

## [1.0.2] - 2018-02-20
### Added
- Allow replacing use statement [#24](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/24)

## [1.0.1] - 2018-01-28
### Fix
- Expand command is not working

## [1.0.0] - 2018-01-28
### Added
- Add built-in php class
### Changed
- Do not import classes that does not exists [#20](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/20)

## [0.9.9] - 2018-01-19
### Fix
- Extension is not working when namespace is in the first line alongside the php tag [#19](https://github.com/MehediDracula/PHP-Namespace-Resolver/pull/19)

## [0.9.8] - 2018-01-09
### Fix
- Extension isnot working on other tab

## [0.9.7] - 2018-01-07
### Added
- Automatically replace selected class when alias is chosen

## [0.9.4] - 2018-01-04
### Added
- Bring back the context menus

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
