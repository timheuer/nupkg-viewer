# NuGet Package Viewer - Testing Guide

## 🧪 Testing Your Extension

### 1. Development Setup
Your extension is now ready for testing! Here's how to test it:

1. **Start Development**: The TypeScript compiler is already running in watch mode
2. **Launch Extension Host**: Press `F5` in VS Code to launch the Extension Development Host
3. **Test with Sample Package**: You'll need a `.nupkg` file to test with

### 2. Getting Test .nupkg Files
You can get test packages in several ways:

#### Option A: Download from NuGet.org
1. Visit [nuget.org](https://www.nuget.org/)
2. Search for any package (e.g., "Newtonsoft.Json")
3. Click "Download package" to get the `.nupkg` file

#### Option B: Create from existing project
```bash
# If you have a .NET project
dotnet pack
```

#### Option C: Use NuGet CLI
```bash
# Download a specific package
nuget install Newtonsoft.Json -OutputDirectory packages
# The .nupkg file will be in the packages folder
```

### 3. Testing the Extension

1. **Open Extension Development Host** (F5)
2. **Open a folder** that contains a `.nupkg` file
3. **Test the features**:
   - Right-click on the `.nupkg` file → "View NuGet Package"
   - Use Command Palette → "Open Package Viewer"
   - Double-click the `.nupkg` file

### 4. Expected Features to Test

#### ✅ Package Information
- [ ] Package icon displays (if available)
- [ ] Package title, ID, and version show correctly
- [ ] Author information displays
- [ ] Description appears in left panel

#### ✅ External Links
- [ ] Project URL button works
- [ ] Repository URL button works  
- [ ] License URL button works

#### ✅ Dependencies
- [ ] Dependencies list shows correctly
- [ ] Version information displays
- [ ] Target framework information shows

#### ✅ File Explorer
- [ ] File tree structure displays
- [ ] File sizes show correctly
- [ ] Folders expand/collapse
- [ ] Files can be clicked to view content

#### ✅ File Viewer
- [ ] Modal opens when clicking files
- [ ] Text files display correctly
- [ ] Code files show with proper formatting
- [ ] Modal closes with X button or Escape key

#### ✅ UI/UX
- [ ] Theme integration works (dark/light themes)
- [ ] Responsive design on different window sizes
- [ ] Loading spinner shows while parsing
- [ ] Error handling for invalid packages

### 5. Common Test Cases

#### Test with Different Package Types
- **Simple Package**: Basic library with few dependencies
- **Complex Package**: Framework package with many dependencies
- **Package with Icon**: Test icon display functionality
- **Large Package**: Test performance with large packages

#### Test Error Scenarios
- **Invalid File**: Try opening a non-.nupkg file renamed to .nupkg
- **Corrupted Package**: Test with a damaged .nupkg file
- **Network Issues**: Test with packages that have invalid URLs

### 6. Performance Testing
- Monitor memory usage with large packages
- Test parsing speed with complex dependency trees
- Check responsiveness of file tree with many files

## 🐛 Debugging Tips

### Common Issues & Solutions

1. **Extension not activating**
   - Check the console for errors (`Developer: Reload Window`)
   - Verify package.json contributions are correct

2. **Package parsing fails**
   - Ensure yauzl and xml2js dependencies are installed
   - Check the .nupkg file is valid (try opening with 7-Zip)

3. **Webview not displaying**
   - Check browser developer tools in the webview
   - Verify HTML/CSS is properly escaped

4. **File content not showing**
   - Test with simple text files first
   - Check file path encoding issues

### Debug Commands
```bash
# Rebuild extension
npm run compile

# Check for lint errors
npm run lint

# Run tests
npm run test
```

## 🚀 Next Steps

Once basic functionality is working, consider adding:

1. **Enhanced Features**
   - Package comparison
   - Export functionality  
   - Search within package
   - Syntax highlighting for code preview

2. **Performance Improvements**
   - Lazy loading for large packages
   - Caching of parsed packages
   - Progressive file tree loading

3. **Additional Integrations**
   - NuGet.org API integration for additional metadata
   - Package vulnerability scanning
   - Dependency graph visualization

Happy testing! 🎉
