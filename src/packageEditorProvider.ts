import * as vscode from 'vscode';
import * as path from 'path';
import { NuGetPackageParser } from './packageParser';
import { PackageContent, FileContent, PackageDependency, NuGetPackageMetadata } from './types';
import { logInfo, logError, logWarning, logDebug, logTrace } from './extension';

export class NuGetPackageEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
    
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        logTrace('Creating NuGetPackageEditorProvider instance...');
        const provider = new NuGetPackageEditorProvider(context);
        logTrace(`Registering custom editor provider with viewType: ${NuGetPackageEditorProvider.viewType}`);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            NuGetPackageEditorProvider.viewType,
            provider,
            {
                // Make this the default editor for .nupkg files
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        logTrace('Custom editor provider registration completed');
        return providerRegistration;
    }

    private static readonly viewType = 'nupkg-viewer.packageEditor';

    constructor(private readonly context: vscode.ExtensionContext) {
        logTrace('NuGetPackageEditorProvider constructor called');
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        logTrace(`openCustomDocument called for URI: ${uri.toString()}`);
        return {
            uri,
            dispose: () => {
                logTrace(`Custom document disposed for: ${uri.toString()}`);
            }
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        logTrace(`resolveCustomEditor called for document: ${document.uri.toString()}`);
        logTrace(`Document file path: ${document.uri.fsPath}`);

        // Setup initial webview properties
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        logTrace('Webview options configured');

        // Set the HTML content
        logTrace('Setting loading HTML...');
        webviewPanel.webview.html = this.getLoadingHtml();

        try {
            logInfo(`Starting to parse package: ${document.uri.fsPath}`);
            // Parse the package
            const packageContent = await NuGetPackageParser.parsePackage(document.uri.fsPath);
            logInfo('Package parsed successfully');
            logTrace(`Package metadata: ${JSON.stringify(packageContent.metadata, null, 2)}`);
            logTrace(`Package has ${packageContent.files.length} files`);
            
            // Update the webview with package data
            logTrace('Updating webview with package data...');
            webviewPanel.webview.html = this.getPackageHtml(packageContent, webviewPanel.webview);
            logTrace('Webview HTML updated successfully');

            // Handle messages from the webview
            webviewPanel.webview.onDidReceiveMessage(
                async (message) => {
                    logTrace(`Received message from webview: ${JSON.stringify(message)}`);
                    switch (message.type) {
                        case 'openFile':
                            logTrace(`Request to open file: ${message.filePath}`);
                            await this.handleOpenFile(document.uri.fsPath, message.filePath, webviewPanel.webview);
                            break;
                        case 'openUrl':
                            if (message.url) {
                                logTrace(`Request to open URL: ${message.url}`);
                                vscode.env.openExternal(vscode.Uri.parse(message.url));
                            }
                            break;
                        default:
                            logWarning(`Unknown message type received: ${message.type}`);
                    }
                },
                undefined,
                this.context.subscriptions
            );
            logTrace('Message handler registered');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logError(`Failed to parse package: ${errorMessage}`, error instanceof Error ? error : undefined);
            webviewPanel.webview.html = this.getErrorHtml(errorMessage);
        }
    }

    private async handleOpenFile(packagePath: string, filePath: string, webview: vscode.Webview): Promise<void> {
        logTrace(`handleOpenFile called for: ${filePath} in package: ${packagePath}`);
        try {
            const fileContent = await NuGetPackageParser.getFileContent(packagePath, filePath);
            logInfo(`File content retrieved successfully for: ${filePath}`);
            logTrace(`File content type: ${fileContent.mimeType}, size: ${fileContent.content.length} bytes`);
            
            // Send file content to webview
            webview.postMessage({
                type: 'fileContent',
                filePath: filePath,
                content: fileContent.content.toString('utf8'),
                mimeType: fileContent.mimeType
            });
            logTrace(`File content sent to webview for: ${filePath}`);
        } catch (error) {
            const errorMessage = `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`;
            logError(`handleOpenFile error for ${filePath}`, error instanceof Error ? error : undefined);
            webview.postMessage({
                type: 'error',
                message: errorMessage
            });
        }
    }

    private getLoadingHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Loading NuGet Package...</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .loading {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 50vh;
                        flex-direction: column;
                    }
                    .spinner {
                        border: 4px solid var(--vscode-progressBar-background);
                        border-top: 4px solid var(--vscode-progressBar-foreground);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 2s linear infinite;
                        margin-bottom: 20px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading NuGet package...</p>
                </div>
            </body>
            </html>
        `;
    }

    private getErrorHtml(error: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error Loading Package</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .error {
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        padding: 15px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <h1>Error Loading NuGet Package</h1>
                <div class="error">
                    <strong>Error:</strong> ${error}
                </div>
                <p>Please ensure this is a valid .nupkg file.</p>
            </body>
            </html>
        `;
    }

    private getPackageHtml(packageContent: PackageContent, webview: vscode.Webview): string {
        const metadata = packageContent.metadata;
        
        // Convert icon data to base64 if available
        let iconDataUrl = '';
        if (packageContent.iconData) {
            const base64 = packageContent.iconData.toString('base64');
            iconDataUrl = `data:image/png;base64,${base64}`;
        }

        // Generate dependencies HTML
        const dependenciesHtml = this.generateDependenciesHtml(metadata.dependencies);

        // Generate file tree HTML
        const fileTreeHtml = this.generateFileTreeHtml(packageContent.files);

        // Generate readme HTML
        const readmeHtml = this.generateReadmeHtml(packageContent.readmeContent, packageContent.readmePath);

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${metadata.id} - NuGet Package Viewer</title>
                <style>
                    ${this.getPackageViewerStyles(webview)}
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- Package Header -->
                    <div class="package-header">
                        <div class="package-icon">
                            ${iconDataUrl ? `<img src="${iconDataUrl}" alt="Package Icon" />` : '<div class="default-icon"><span class="codicon codicon-package"></span></div>'}
                        </div>
                        <div class="package-info">
                            <h1 class="package-title">${metadata.title || metadata.id}</h1>
                            <div class="package-id">ID: ${metadata.id}</div>
                            <div class="package-version">Version: ${metadata.version}</div>
                            ${metadata.authors && metadata.authors.length > 0 ? `<div class="package-authors">By: ${metadata.authors.join(', ')}</div>` : ''}
                            ${this.getLicenseInfoHtml(metadata)}
                            ${metadata.description ? `<div class="package-description">${metadata.description}</div>` : ''}
                        </div>
                        <div class="package-actions">
                            ${metadata.projectUrl ? `<button class="action-btn" onclick="openUrl('${metadata.projectUrl}')"><span class="codicon codicon-globe"></span> Project</button>` : ''}
                            ${metadata.repositoryUrl ? `<button class="action-btn" onclick="openUrl('${metadata.repositoryUrl}')"><span class="codicon codicon-repo"></span> Repository</button>` : ''}
                        </div>
                    </div>

                    <!-- Tabbed Content -->
                    <div class="tabbed-content">
                        <div class="tab-headers">
                            ${packageContent.readmeContent ? '<button class="tab-header active" onclick="switchTab(\'readme\')"><span class="codicon codicon-note"></span> Readme</button>' : ''}
                            <button class="tab-header${!packageContent.readmeContent ? ' active' : ''}" onclick="switchTab('dependencies')"><span class="codicon codicon-link"></span> Dependencies</button>
                            ${packageContent.licenseContent ? '<button class="tab-header" onclick="switchTab(\'license\')"><span class="codicon codicon-law"></span> License</button>' : ''}
                            <button class="tab-header" onclick="switchTab('contents')"><span class="codicon codicon-book"></span> Contents</button>
                        </div>

                        <div class="tab-content">
                            ${packageContent.readmeContent ? `
                            <div id="readme-tab" class="tab-panel${packageContent.readmeContent ? ' active' : ''}">
                                ${readmeHtml}
                            </div>
                            ` : ''}

                            <div id="dependencies-tab" class="tab-panel${!packageContent.readmeContent ? ' active' : ''}">
                                <h3>Dependencies</h3>
                                ${dependenciesHtml}
                                
                                ${metadata.tags && metadata.tags.length > 0 ? `
                                <h3>Tags</h3>
                                <div class="tags">
                                    ${metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                                ` : ''}

                                ${metadata.releaseNotes ? `
                                <h3>Release Notes</h3>
                                <div class="release-notes">${metadata.releaseNotes}</div>
                                ` : ''}
                            </div>

                            ${packageContent.licenseContent ? `
                            <div id="license-tab" class="tab-panel">
                                ${this.generateLicenseHtml(packageContent.licenseContent, packageContent.licensePath)}
                            </div>
                            ` : ''}

                            <div id="contents-tab" class="tab-panel">
                                <div class="contents-header">
                                    <h3>Package Contents</h3>
                                    <div class="tree-controls">
                                        <button class="tree-btn" onclick="expandAllFolders()" title="Expand All"><span class="codicon codicon-expand-all"></span> Expand All</button>
                                        <button class="tree-btn" onclick="collapseAllFolders()" title="Collapse All"><span class="codicon codicon-collapse-all"></span> Collapse All</button>
                                    </div>
                                </div>
                                <div class="file-explorer">
                                    ${fileTreeHtml}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- File Viewer Modal -->
                    <div id="fileModal" class="modal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3 id="modalTitle">File Viewer</h3>
                                <span class="close codicon codicon-close" onclick="closeModal()"></span>
                            </div>
                            <div class="modal-body">
                                <pre id="fileContent"></pre>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    ${this.getPackageViewerScript()}
                </script>
            </body>
            </html>
        `;
    }

    private generateFileTreeHtml(files: any[], level: number = 0): string {
        return files.map(file => {
            const indent = level * 20;
            if (file.isDirectory) {
                const folderId = `folder-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
                return `
                    <div class="folder-container">
                        <div class="folder" style="margin-left: ${indent}px;" onclick="toggleFolder('${folderId}')">
                            <span class="folder-toggle codicon codicon-chevron-right"></span>
                            <span class="folder-icon codicon codicon-folder"></span>
                            <span class="folder-name">${file.name}</span>
                        </div>
                        <div id="${folderId}" class="folder-children" style="display: none;">
                            ${file.children ? this.generateFileTreeHtml(file.children, level + 1) : ''}
                        </div>
                    </div>
                `;
            } else {
                const fileIcon = this.getFileIcon(file.name);
                return `
                    <div class="file" style="margin-left: ${indent}px;" onclick="openFile('${file.path}')" title="${file.path}">
                        <span class="file-icon codicon ${fileIcon}"></span>
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">(${this.formatFileSize(file.size)})</span>
                    </div>
                `;
            }
        }).join('');
    }

    private getFileIcon(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const iconMap: { [key: string]: string } = {
            '.cs': 'codicon-file-code',
            '.vb': 'codicon-file-code',
            '.fs': 'codicon-file-code',
            '.js': 'codicon-file-code',
            '.ts': 'codicon-file-code',
            '.json': 'codicon-json',
            '.xml': 'codicon-file-code',
            '.config': 'codicon-settings-gear',
            '.dll': 'codicon-library',
            '.exe': 'codicon-gear',
            '.pdb': 'codicon-debug',
            '.txt': 'codicon-file-text',
            '.md': 'codicon-markdown',
            '.yml': 'codicon-file-code',
            '.yaml': 'codicon-file-code',
            '.png': 'codicon-file-media',
            '.jpg': 'codicon-file-media',
            '.jpeg': 'codicon-file-media',
            '.gif': 'codicon-file-media',
            '.ico': 'codicon-file-media'
        };
        return iconMap[ext] || 'codicon-file';
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    private getPackageViewerStyles(webview: vscode.Webview): string {
        // Get the codicon font URI for the webview from our local media directory
        const codiconFontUri = vscode.Uri.file(
            path.join(this.context.extensionPath, 'media', 'codicons', 'codicon.ttf')
        );
        const codiconFontWebviewUri = webview.asWebviewUri(codiconFontUri);
        
        return `
            /* Codicon Font Face */
            @font-face {
                font-family: "codicon";
                font-display: block;
                src: url("${codiconFontWebviewUri.toString()}") format("truetype");
            }

            /* Codicon Base Class */
            .codicon {
                font: normal normal normal 16px/1 codicon;
                display: inline-block;
                text-decoration: none;
                text-rendering: auto;
                text-align: center;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                user-select: none;
                -webkit-user-select: none;
                -ms-user-select: none;
            }

            /* Common Codicon Classes */
            .codicon-package:before { content: "\\eb29"; }
            .codicon-globe:before { content: "\\eb01"; }
            .codicon-repo:before { content: "\\ea62"; }
            .codicon-expand-all:before { content: "\\eb95"; }
            .codicon-collapse-all:before { content: "\\eac5"; }
            .codicon-close:before { content: "\\ea76"; }
            .codicon-chevron-right:before { content: "\\eab6"; }
            .codicon-chevron-down:before { content: "\eab4" }
            .codicon-folder:before { content: "\\eb46"; }
            .codicon-file:before { content: "\\eb60"; }
            .codicon-file-code:before { content: "\\eae9"; }
            .codicon-file-text:before { content: "\\ea7b"; }
            .codicon-file-media:before { content: "\\eaea"; }
            .codicon-markdown:before { content: "\\eb1d"; }
            .codicon-settings-gear:before { content: "\\eb51"; }
            .codicon-library:before { content: "\\eb9c"; }
            .codicon-gear:before { content: "\\eaf8"; }
            .codicon-debug:before { content: "\\ead8"; }
            .codicon-law:before { content: "\\eb12"; }
            .codicon-link:before { content: "\\eb15"; }
            .codicon-note:before { content: "\\eb26"; }
            .codicon-book:before { content: "\\eaa4"; }
            .codicon-json:before { content: "\\eb0f" }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                line-height: 1.6;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }

            .package-header {
                display: flex;
                align-items: flex-start;
                gap: 20px;
                padding: 20px;
                background-color: var(--vscode-sideBar-background);
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid var(--vscode-sideBar-border);
            }

            .package-icon img {
                width: 80px;
                height: 80px;
                border-radius: 8px;
            }

            .default-icon {
                width: 80px;
                height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--vscode-button-background);
                border-radius: 8px;
            }

            .default-icon .codicon {
                font-size: 40px;
                color: var(--vscode-button-foreground);
            }

            .package-info {
                flex: 1;
            }

            .package-title {
                margin: 0 0 10px 0;
                font-size: 24px;
                font-weight: 600;
            }

            .package-id, .package-version, .package-authors, .package-license {
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }

            .package-license a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
            }

            .package-license a:hover {
                color: var(--vscode-textLink-activeForeground);
                text-decoration: underline;
            }

            .package-description {
                margin: 10px 0 0 0;
                color: var(--vscode-editor-foreground);
                font-size: 14px;
                line-height: 1.5;
            }

            .package-actions {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .action-btn {
                padding: 8px 16px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .action-btn .codicon {
                font-size: 16px;
            }

            .action-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
            }

            /* Tabbed Interface */
            .tabbed-content {
                background-color: var(--vscode-sideBar-background);
                border-radius: 8px;
                border: 1px solid var(--vscode-sideBar-border);
            }

            .tab-headers {
                display: flex;
                background-color: var(--vscode-tab-inactiveBackground);
                border-radius: 8px 8px 0 0;
                border-bottom: 1px solid var(--vscode-sideBar-border);
            }

            .tab-header {
                padding: 12px 20px;
                background: none;
                border: none;
                color: var(--vscode-tab-inactiveForeground);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
                border-radius: 8px 8px 0 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .tab-header .codicon {
                font-size: 16px;
            }

            .tab-header:first-child {
                border-radius: 8px 0 0 0;
            }

            .tab-header.active {
                background-color: var(--vscode-tab-activeBackground);
                color: var(--vscode-tab-activeForeground);
                border-bottom: 2px solid var(--vscode-tab-activeBorder);
            }

            .tab-header:hover:not(.active) {
                background-color: var(--vscode-tab-hoverBackground);
                color: var(--vscode-tab-hoverForeground);
            }

            .tab-content {
                padding: 20px;
            }

            .tab-panel {
                display: none;
            }

            .tab-panel.active {
                display: block;
            }

            /* Tab Panel Content */
            .tab-panel h3 {
                margin: 0 0 15px 0;
                font-size: 18px;
                font-weight: 600;
                border-bottom: 1px solid var(--vscode-sideBar-border);
                padding-bottom: 5px;
            }

            /* Readme Styles */
            .readme-content {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
            }

            .readme-header {
                padding: 15px;
                background-color: var(--vscode-sideBar-background);
                border-bottom: 1px solid var(--vscode-input-border);
                border-radius: 4px 4px 0 0;
            }

            .readme-header h3 {
                margin: 0 0 5px 0;
                border: none;
                padding: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .readme-header h3 .codicon {
                font-size: 18px;
            }

            .readme-header small {
                color: var(--vscode-descriptionForeground);
            }

            .markdown-content, .text-content {
                margin: 0;
                padding: 15px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                overflow-x: auto;
                white-space: pre-wrap;
                border-radius: 0 0 4px 4px;
            }

            .no-readme {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                text-align: center;
                padding: 40px;
            }

            /* License Styles */
            .license-content {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
            }

            .license-header {
                padding: 15px;
                background-color: var(--vscode-sideBar-background);
                border-bottom: 1px solid var(--vscode-input-border);
                border-radius: 4px 4px 0 0;
            }

            .license-header h3 {
                margin: 0;
                border: none;
                padding: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .license-header h3 .codicon {
                font-size: 18px;
            }

            .no-license {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                text-align: center;
                padding: 40px;
            }

            /* Dependencies Styles */
            .dependencies {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 20px;
            }

            .dependency {
                padding: 12px;
                background-color: var(--vscode-editor-background);
                border-radius: 4px;
                border: 1px solid var(--vscode-input-border);
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .dependency strong {
                color: var(--vscode-editor-foreground);
            }

            .dependency .version, .dependency .framework {
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 3px;
            }

            .no-deps {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                text-align: center;
                padding: 20px;
            }

            .tags {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 20px;
            }

            .tag {
                padding: 4px 8px;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 12px;
                font-size: 12px;
            }

            .release-notes {
                white-space: pre-wrap;
                background-color: var(--vscode-editor-background);
                padding: 15px;
                border-radius: 4px;
                border: 1px solid var(--vscode-input-border);
                margin-bottom: 20px;
            }

            /* File Explorer Styles */
            .file-explorer {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 10px;
                max-height: 600px;
                overflow-y: auto;
            }

            .contents-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }

            .contents-header h3 {
                margin: 0;
            }

            .tree-controls {
                display: flex;
                gap: 8px;
            }

            .tree-btn {
                padding: 6px 12px;
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: 1px solid var(--vscode-button-border);
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .tree-btn .codicon {
                font-size: 14px;
            }

            .tree-btn:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            .folder-container {
                margin-bottom: 2px;
            }

            .folder, .file {
                padding: 6px 8px;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 1px;
            }

            .folder:hover, .file:hover {
                background-color: var(--vscode-list-hoverBackground);
            }

            .folder-toggle {
                width: 16px;
                height: 16px;
                text-align: center;
                transition: transform 0.2s;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .folder-toggle.expanded {
                transform: rotate(90deg);
            }

            .folder-icon, .file-icon {
                width: 16px;
                height: 16px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .folder-icon .codicon, .file-icon .codicon {
                font-size: 16px;
            }

            .folder-name, .file-name {
                flex: 1;
                font-size: 14px;
            }

            .file-size {
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
                margin-left: auto;
            }

            .folder-children {
                margin-left: 8px;
            }

            /* Modal Styles */
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }

            .modal-content {
                background-color: var(--vscode-editor-background);
                margin: 5% auto;
                padding: 0;
                border: 1px solid var(--vscode-input-border);
                border-radius: 8px;
                width: 80%;
                max-width: 800px;
                max-height: 80%;
                display: flex;
                flex-direction: column;
            }

            .modal-header {
                padding: 15px 20px;
                background-color: var(--vscode-sideBar-background);
                border-bottom: 1px solid var(--vscode-sideBar-border);
                border-radius: 8px 8px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .modal-header h3 {
                margin: 0;
                border: none;
                padding: 0;
            }

            .close {
                color: var(--vscode-descriptionForeground);
                cursor: pointer;
                line-height: 1;
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
            }

            .close:hover {
                color: var(--vscode-errorForeground);
            }

            .modal-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }

            #fileContent {
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 15px;
                margin: 0;
                overflow-x: auto;
                white-space: pre-wrap;
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
            }

            @media (max-width: 768px) {
                .package-header {
                    flex-direction: column;
                    text-align: center;
                }
                
                .tab-headers {
                    flex-direction: column;
                }
                
                .tab-header {
                    border-radius: 0;
                }
                
                .tab-header:first-child {
                    border-radius: 8px 8px 0 0;
                }
                
                .modal-content {
                    width: 95%;
                    margin: 2% auto;
                }
            }
        `;
    }

    private getPackageViewerScript(): string {
        return `
            const vscode = acquireVsCodeApi();

            function openUrl(url) {
                vscode.postMessage({
                    type: 'openUrl',
                    url: url
                });
            }

            function openFile(filePath) {
                vscode.postMessage({
                    type: 'openFile',
                    filePath: filePath
                });
            }

            function closeModal() {
                document.getElementById('fileModal').style.display = 'none';
            }

            function switchTab(tabName) {
                // Hide all tab panels
                const panels = document.querySelectorAll('.tab-panel');
                panels.forEach(panel => panel.classList.remove('active'));
                
                // Remove active class from all tab headers
                const headers = document.querySelectorAll('.tab-header');
                headers.forEach(header => header.classList.remove('active'));
                
                // Show the selected tab panel
                const targetPanel = document.getElementById(tabName + '-tab');
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
                
                // Add active class to the clicked tab header
                const clickedHeader = Array.from(headers).find(header => 
                    header.getAttribute('onclick').includes(tabName)
                );
                if (clickedHeader) {
                    clickedHeader.classList.add('active');
                }
            }

            function toggleFolder(folderId) {
                const folderElement = document.getElementById(folderId);
                const toggleElement = document.querySelector('[onclick="toggleFolder(\\'' + folderId + '\\')"] .folder-toggle');
                
                if (folderElement && toggleElement) {
                    if (folderElement.style.display === 'none') {
                        folderElement.style.display = 'block';
                        toggleElement.classList.add('expanded');
                    } else {
                        folderElement.style.display = 'none';
                        toggleElement.classList.remove('expanded');
                    }
                }
            }

            function expandAllFolders() {
                const allFolders = document.querySelectorAll('.folder-children');
                allFolders.forEach(folder => {
                    if (folder.style.display === 'none') {
                        const folderId = folder.id;
                        if (folderId) {
                            toggleFolder(folderId);
                        }
                    }
                });
            }

            function collapseAllFolders() {
                const allFolders = document.querySelectorAll('.folder-children');
                allFolders.forEach(folder => {
                    if (folder.style.display !== 'none') {
                        const folderId = folder.id;
                        if (folderId) {
                            toggleFolder(folderId);
                        }
                    }
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.type) {
                    case 'fileContent':
                        showFileContent(message.filePath, message.content, message.mimeType);
                        break;
                    case 'error':
                        alert('Error: ' + message.message);
                        break;
                }
            });

            function showFileContent(filePath, content, mimeType) {
                const modal = document.getElementById('fileModal');
                const title = document.getElementById('modalTitle');
                const contentElement = document.getElementById('fileContent');
                
                title.textContent = filePath;
                
                // Handle different content types
                if (mimeType && mimeType.startsWith('image/')) {
                    contentElement.innerHTML = '<img src="data:' + mimeType + ';base64,' + btoa(content) + '" style="max-width: 100%; height: auto;" />';
                } else {
                    contentElement.textContent = content;
                }
                
                modal.style.display = 'block';
            }

            // Close modal when clicking outside of it
            window.onclick = function(event) {
                const modal = document.getElementById('fileModal');
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            }

            // Close modal with Escape key
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    closeModal();
                }
            });

            // Initialize - all folders start collapsed by default
        `;
    }

    private generateDependenciesHtml(dependencies?: PackageDependency[]): string {
        if (!dependencies || dependencies.length === 0) {
            return '<p class="no-deps">No dependencies</p>';
        }

        return dependencies.map(dep => `
            <div class="dependency">
                <strong>${dep.id}</strong>
                ${dep.version ? `<span class="version">${dep.version}</span>` : ''}
                ${dep.targetFramework ? `<span class="framework">${dep.targetFramework}</span>` : ''}
            </div>
        `).join('');
    }

    private generateReadmeHtml(readmeContent?: string, readmePath?: string): string {
        if (!readmeContent) {
            return '<p class="no-readme">No readme file found in this package.</p>';
        }

        // Check if it's markdown
        if (readmePath && readmePath.toLowerCase().endsWith('.md')) {
            // For now, we'll display as plain text but wrapped in a code block
            // In a future version, we could add a markdown parser
            return `
                <div class="readme-content">
                    <div class="readme-header">
                        <h3><span class="codicon codicon-markdown"></span> ${readmePath}</h3>
                        <small>Markdown content (displaying as plain text)</small>
                    </div>
                    <pre class="markdown-content">${this.escapeHtml(readmeContent)}</pre>
                </div>
            `;
        } else {
            return `
                <div class="readme-content">
                    <div class="readme-header">
                        <h3><span class="codicon codicon-file-text"></span> ${readmePath || 'README'}</h3>
                    </div>
                    <pre class="text-content">${this.escapeHtml(readmeContent)}</pre>
                </div>
            `;
        }
    }

    private getLicenseInfoHtml(metadata: NuGetPackageMetadata): string {
        if (metadata.license && metadata.licenseType === 'expression') {
            return `<div class="package-license">License: ${this.escapeHtml(metadata.license)}</div>`;
        } else if (metadata.licenseUrl) {
            return `<div class="package-license">License: <a href="${metadata.licenseUrl}" onclick="openUrl('${metadata.licenseUrl}'); return false;">${this.escapeHtml(metadata.licenseUrl)}</a></div>`;
        }
        return '';
    }

    private generateLicenseHtml(licenseContent?: string, licensePath?: string): string {
        if (!licenseContent) {
            return '<p class="no-license">No license file found in this package.</p>';
        }

        return `
            <div class="license-content">
                <div class="license-header">
                    <h3><span class="codicon codicon-law"></span> ${licensePath || 'LICENSE'}</h3>
                </div>
                <pre class="text-content">${this.escapeHtml(licenseContent)}</pre>
            </div>
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
