# Change Log

All notable changes to the "nupkg-viewer" extension will be documented in this file.

## [Unreleased]

### Added
- Complete NuGet package visualization system
- Custom editor for .nupkg files with webview interface
- Package metadata display (title, version, description, authors)
- Interactive file tree explorer for package contents
- File content preview with modal viewer
- External link integration (project, repository, license URLs)
- Dependencies list with version and framework information
- Package icon display support
- Tags and release notes display
- Modern VS Code-integrated UI with theme support
- Context menu integration for .nupkg files
- Command palette commands for opening packages
- Responsive design for different screen sizes

### Technical Implementation
- TypeScript-based extension architecture
- yauzl library integration for ZIP/nupkg file parsing
- xml2js library for .nuspec file parsing
- Custom webview provider with HTML/CSS/JavaScript interface
- Proper VS Code theme integration
- Error handling and user feedback systems

## [0.0.1] - 2025-06-24

### Added
- Initial extension scaffold
- Basic "Hello World" functionality
- Project structure setup

---

## Development Notes

### Architecture Decisions
- **Custom Editor Approach**: Used VS Code's custom editor API instead of separate panels for better integration
- **Webview Implementation**: HTML/CSS/JS for rich UI that matches VS Code's design system
- **Package Parsing**: Direct ZIP parsing with yauzl for better control over file extraction
- **Type Safety**: Full TypeScript implementation with proper type definitions

### Future Enhancements
- Package comparison functionality
- Search within package contents
- Export package information to various formats
- Integration with NuGet.org API for additional metadata
- Package vulnerability scanning
- Dependency graph visualization
- Performance optimizations for large packages

## [Unreleased]

- Initial release