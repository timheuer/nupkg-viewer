import * as vscode from 'vscode';
import * as path from 'path';
import { NuGetPackageParser } from './packageParser';
import { PackageContent, FileContent, PackageDependency } from './types';
import { logInfo, logError, logWarning, logDebug } from './extension';

export class NuGetPackageEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
    
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        logInfo('Creating NuGetPackageEditorProvider instance...');
        const provider = new NuGetPackageEditorProvider(context);
        logInfo(`Registering custom editor provider with viewType: ${NuGetPackageEditorProvider.viewType}`);
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
        logInfo('Custom editor provider registration completed');
        return providerRegistration;
    }

    private static readonly viewType = 'nupkg-viewer.packageEditor';

    constructor(private readonly context: vscode.ExtensionContext) {
        logInfo('NuGetPackageEditorProvider constructor called');
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        logInfo(`openCustomDocument called for URI: ${uri.toString()}`);
        return {
            uri,
            dispose: () => {
                logInfo(`Custom document disposed for: ${uri.toString()}`);
            }
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        logInfo(`resolveCustomEditor called for document: ${document.uri.toString()}`);
        logInfo(`Document file path: ${document.uri.fsPath}`);
        
        // Setup initial webview properties
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        logInfo('Webview options configured');

        // Set the HTML content
        logInfo('Setting loading HTML...');
        webviewPanel.webview.html = this.getLoadingHtml();

        try {
            logInfo(`Starting to parse package: ${document.uri.fsPath}`);
            // Parse the package
            const packageContent = await NuGetPackageParser.parsePackage(document.uri.fsPath);
            logInfo('Package parsed successfully');
            logDebug(`Package metadata: ${JSON.stringify(packageContent.metadata, null, 2)}`);
            logDebug(`Package has ${packageContent.files.length} files`);
            
            // Update the webview with package data
            logInfo('Updating webview with package data...');
            webviewPanel.webview.html = this.getPackageHtml(packageContent, webviewPanel.webview);
            logInfo('Webview HTML updated successfully');

            // Handle messages from the webview
            webviewPanel.webview.onDidReceiveMessage(
                async (message) => {
                    logDebug(`Received message from webview: ${JSON.stringify(message)}`);
                    switch (message.type) {
                        case 'openFile':
                            logInfo(`Request to open file: ${message.filePath}`);
                            await this.handleOpenFile(document.uri.fsPath, message.filePath, webviewPanel.webview);
                            break;
                        case 'openUrl':
                            if (message.url) {
                                logInfo(`Request to open URL: ${message.url}`);
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
            logInfo('Message handler registered');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logError(`Failed to parse package: ${errorMessage}`, error instanceof Error ? error : undefined);
            webviewPanel.webview.html = this.getErrorHtml(errorMessage);
        }
    }

    private async handleOpenFile(packagePath: string, filePath: string, webview: vscode.Webview): Promise<void> {
        logInfo(`handleOpenFile called for: ${filePath} in package: ${packagePath}`);
        try {
            const fileContent = await NuGetPackageParser.getFileContent(packagePath, filePath);
            logInfo(`File content retrieved successfully for: ${filePath}`);
            logDebug(`File content type: ${fileContent.mimeType}, size: ${fileContent.content.length} bytes`);
            
            // Send file content to webview
            webview.postMessage({
                type: 'fileContent',
                filePath: filePath,
                content: fileContent.content.toString('utf8'),
                mimeType: fileContent.mimeType
            });
            logInfo(`File content sent to webview for: ${filePath}`);
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
                    ${this.getPackageViewerStyles()}
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- Package Header -->
                    <div class="package-header">
                        <div class="package-icon">
                            ${iconDataUrl ? `<img src="${iconDataUrl}" alt="Package Icon" />` : '<div class="default-icon">📦</div>'}
                        </div>
                        <div class="package-info">
                            <h1 class="package-title">${metadata.title || metadata.id}</h1>
                            <div class="package-id">ID: ${metadata.id}</div>
                            <div class="package-version">Version: ${metadata.version}</div>
                            ${metadata.authors && metadata.authors.length > 0 ? `<div class="package-authors">By: ${metadata.authors.join(', ')}</div>` : ''}
                            ${metadata.description ? `<div class="package-description">${metadata.description}</div>` : ''}
                        </div>
                        <div class="package-actions">
                            ${metadata.projectUrl ? `<button class="action-btn" onclick="openUrl('${metadata.projectUrl}')">🌐 Project</button>` : ''}
                            ${metadata.repositoryUrl ? `<button class="action-btn" onclick="openUrl('${metadata.repositoryUrl}')">📦 Repository</button>` : ''}
                            ${metadata.licenseUrl ? `<button class="action-btn" onclick="openUrl('${metadata.licenseUrl}')">📄 License</button>` : ''}
                        </div>
                    </div>

                    <!-- Tabbed Content -->
                    <div class="tabbed-content">
                        <div class="tab-headers">
                            ${packageContent.readmeContent ? '<button class="tab-header active" onclick="switchTab(\'readme\')">Readme</button>' : ''}
                            <button class="tab-header${!packageContent.readmeContent ? ' active' : ''}" onclick="switchTab('dependencies')">Dependencies</button>
                            <button class="tab-header" onclick="switchTab('contents')">Contents</button>
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

                            <div id="contents-tab" class="tab-panel">
                                <h3>Package Contents</h3>
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
                                <span class="close" onclick="closeModal()">&times;</span>
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
                            <span class="folder-toggle">▶</span>
                            <span class="folder-icon">📁</span>
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
                        <span class="file-icon">${fileIcon}</span>
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
            '.cs': '📝',
            '.vb': '📝',
            '.fs': '📝',
            '.js': '📄',
            '.ts': '📄',
            '.json': '📄',
            '.xml': '📄',
            '.config': '⚙️',
            '.dll': '📚',
            '.exe': '⚙️',
            '.pdb': '🔍',
            '.txt': '📄',
            '.md': '📖',
            '.yml': '📄',
            '.yaml': '📄',
            '.png': '🖼️',
            '.jpg': '🖼️',
            '.jpeg': '🖼️',
            '.gif': '🖼️',
            '.ico': '🖼️'
        };
        return iconMap[ext] || '📄';
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

    private getPackageViewerStyles(): string {
        return `
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
                font-size: 40px;
                background-color: var(--vscode-button-background);
                border-radius: 8px;
            }

            .package-info {
                flex: 1;
            }

            .package-title {
                margin: 0 0 10px 0;
                font-size: 24px;
                font-weight: 600;
            }

            .package-id, .package-version, .package-authors {
                margin: 5px 0;
                color: var(--vscode-descriptionForeground);
                font-size: 14px;
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
                width: 12px;
                text-align: center;
                font-size: 10px;
                transition: transform 0.2s;
                user-select: none;
            }

            .folder-toggle.expanded {
                transform: rotate(90deg);
            }

            .folder-icon, .file-icon {
                width: 16px;
                text-align: center;
                font-size: 14px;
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
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                line-height: 1;
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
                        toggleElement.textContent = '▼';
                        toggleElement.classList.add('expanded');
                    } else {
                        folderElement.style.display = 'none';
                        toggleElement.textContent = '▶';
                        toggleElement.classList.remove('expanded');
                    }
                }
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

            // Initialize - expand root folders by default
            document.addEventListener('DOMContentLoaded', function() {
                const rootFolders = document.querySelectorAll('.folder-container:nth-child(-n+3) .folder');
                rootFolders.forEach(folder => {
                    const onclick = folder.getAttribute('onclick');
                    if (onclick) {
                        const folderId = onclick.match(/toggleFolder\\('([^']+)'\\)/)[1];
                        if (folderId) {
                            toggleFolder(folderId);
                        }
                    }
                });
            });
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
                        <h3>📄 ${readmePath}</h3>
                        <small>Markdown content (displaying as plain text)</small>
                    </div>
                    <pre class="markdown-content">${this.escapeHtml(readmeContent)}</pre>
                </div>
            `;
        } else {
            return `
                <div class="readme-content">
                    <div class="readme-header">
                        <h3>📄 ${readmePath || 'README'}</h3>
                    </div>
                    <pre class="text-content">${this.escapeHtml(readmeContent)}</pre>
                </div>
            `;
        }
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
