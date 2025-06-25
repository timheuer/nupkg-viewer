# NuGet Package Viewer

A VS Code extension that provides a comprehensive visualization of NuGet packages (.nupkg files). View package metadata, explore contents, and get detailed information similar to nuget.org with an intuitive file explorer interface.

## ✨ Features

### 📦 Package Information Display
- **Package Metadata**: Title, version, ID, and description
- **Author Information**: Package authors and owners
- **Visual Icon**: Display package icons when available
- **External Links**: Quick access to project URL, repository, and license

### 🗂️ Package Contents Explorer
- **File Tree Navigation**: Browse package contents in an intuitive tree structure
- **File Preview**: View file contents directly within VS Code
- **Size Information**: See file sizes for better understanding of package composition
- **Syntax Highlighting**: Proper highlighting for code files

### 🔗 Dependencies & Metadata
- **Dependency List**: View all package dependencies with version information
- **Framework Targets**: See target framework information for dependencies
- **Tags & Categories**: Browse package tags for easy categorization
- **Release Notes**: Read package release notes when available

### 🎨 Modern UI
- **VS Code Theme Integration**: Seamlessly integrates with your current VS Code theme
- **Responsive Design**: Works well on different screen sizes
- **Modal File Viewer**: View files in a dedicated modal with proper formatting
- **Marketplace-Style Layout**: Familiar interface similar to VS Code extension marketplace

### 📊 Comprehensive Logging
- **Detailed Operation Logs**: Track all extension operations in real-time
- **Error Diagnostics**: Detailed error reporting for troubleshooting
- **Performance Monitoring**: Monitor parsing and loading times
- **Debug Information**: Extensive debug output for development and support

## 🚀 Usage

### Opening a Package

1. **Double-click method**: Double-click on any `.nupkg` file in the Explorer to open it with the NuGet Package Viewer
2. **Right-click method**: Right-click on any `.nupkg` file in the Explorer and select "View NuGet Package"
3. **Command Palette**: Open Command Palette (`Ctrl+Shift+P`) and run "Open Package Viewer" to select a file

### Navigating the Interface
- **Package Header**: Shows icon, title, version, and quick action buttons
- **Left Panel**: Contains package description, dependencies, tags, and release notes
- **Right Panel**: File explorer for browsing package contents
- **File Viewer**: Click on any file to view its contents in a modal window

### External Actions
- Click **🌐 Project** to open the project URL
- Click **📦 Repository** to view the source repository
- Click **📄 License** to read the license terms

### Viewing Extension Logs

To see detailed logging information and troubleshoot issues:

1. Open the **Output** panel (`View` > `Output` or `Ctrl+Shift+U`)
2. In the dropdown, select **"NuGet Package Viewer"**
3. You'll see detailed logs including:
   - Extension activation and setup
   - Package parsing progress and errors
   - File operations and content loading
   - Performance metrics and timing information
   - Error details with stack traces

## 📋 Requirements

- VS Code 1.101.0 or higher
- Node.js (for development)

## 🔧 Extension Settings

This extension provides the following configuration options:

* `nupkg-viewer.logLevel`: Controls the verbosity of logging output in the NuGet Package Viewer output channel
  * `off`: Disable all logging
  * `error`: Only log errors
  * `warn`: Log warnings and errors  
  * `info`: Log info, warnings, and errors (default)
  * `verbose`: Log all messages including debug information
  * `trace`: Log all messages including trace information (most verbose)

## 🐛 Known Issues

- Very large packages (>100MB) may take some time to parse
- Binary files in the package are not previewable (by design)
- Some older .nupkg formats may not parse completely

## 🛠️ Development

### Building from Source
```bash
git clone <repository-url>
cd nupkg-viewer
npm install
npm run compile
```

### Running the Extension
1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open a `.nupkg` file to test the extension

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and enhancement requests.

## 📄 License

See LICENSE file for details.

---

**Enjoy exploring your NuGet packages with style! 📦✨**