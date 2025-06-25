import * as vscode from 'vscode';
import * as path from 'path';
import { NuGetPackageParser } from './packageParser';
import { PackageContent, FileContent } from './types';
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
        const dependenciesHtml = metadata.dependencies && metadata.dependencies.length > 0
            ? metadata.dependencies.map(dep => `
                <div class="dependency">
                    <strong>${dep.id}</strong>
                    ${dep.version ? `<span class="version">${dep.version}</span>` : ''}
                    ${dep.targetFramework ? `<span class="framework">${dep.targetFramework}</span>` : ''}
                </div>
            `).join('')
            : '<p class="no-deps">No dependencies</p>';

        // Generate file tree HTML
        const fileTreeHtml = this.generateFileTreeHtml(packageContent.files);

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
                        </div>
                        <div class="package-actions">
                            ${metadata.projectUrl ? `<button class="action-btn" onclick="openUrl('${metadata.projectUrl}')">🌐 Project</button>` : ''}
                            ${metadata.repositoryUrl ? `<button class="action-btn" onclick="openUrl('${metadata.repositoryUrl}')">📦 Repository</button>` : ''}
                            ${metadata.licenseUrl ? `<button class="action-btn" onclick="openUrl('${metadata.licenseUrl}')">📄 License</button>` : ''}
                        </div>
                    </div>

                    <!-- Package Content -->
                    <div class="package-content">
                        <!-- Left Panel: Package Info -->
                        <div class="left-panel">
                            ${metadata.description ? `
                            <div class="section">
                                <h3>Description</h3>
                                <p class="description">${metadata.description}</p>
                            </div>
                            ` : ''}

                            <div class="section">
                                <h3>Dependencies</h3>
                                <div class="dependencies">
                                    ${dependenciesHtml}
                                </div>
                            </div>

                            ${metadata.tags && metadata.tags.length > 0 ? `
                            <div class="section">
                                <h3>Tags</h3>
                                <div class="tags">
                                    ${metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                            ` : ''}

                            ${metadata.releaseNotes ? `
                            <div class="section">
                                <h3>Release Notes</h3>
                                <div class="release-notes">${metadata.releaseNotes}</div>
                            </div>
                            ` : ''}
                        </div>

                        <!-- Right Panel: File Explorer -->
                        <div class="right-panel">
                            <div class="section">
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
            const indent = '  '.repeat(level);
            if (file.isDirectory) {
                return `
                    <div class="folder" style="margin-left: ${level * 20}px;">
                        <span class="folder-icon">📁</span>
                        <span class="folder-name">${file.name}</span>
                        ${file.children ? this.generateFileTreeHtml(file.children, level + 1) : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="file" style="margin-left: ${level * 20}px;" onclick="openFile('${file.path}')">
                        <span class="file-icon">📄</span>
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">(${this.formatFileSize(file.size)})</span>
                    </div>
                `;
            }
        }).join('');
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

            .package-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }

            .left-panel, .right-panel {
                background-color: var(--vscode-sideBar-background);
                border-radius: 8px;
                padding: 20px;
                border: 1px solid var(--vscode-sideBar-border);
            }

            .section {
                margin-bottom: 20px;
            }

            .section h3 {
                margin: 0 0 15px 0;
                font-size: 18px;
                font-weight: 600;
                border-bottom: 1px solid var(--vscode-sideBar-border);
                padding-bottom: 5px;
            }

            .description {
                line-height: 1.6;
            }

            .dependencies {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .dependency {
                padding: 10px;
                background-color: var(--vscode-editor-background);
                border-radius: 4px;
                border: 1px solid var(--vscode-input-border);
            }

            .dependency .version, .dependency .framework {
                margin-left: 10px;
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }

            .no-deps {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }

            .tags {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
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
                padding: 10px;
                border-radius: 4px;
                border: 1px solid var(--vscode-input-border);
            }

            .file-explorer {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 10px;
                max-height: 400px;
                overflow-y: auto;
            }

            .folder, .file {
                padding: 4px 8px;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .file:hover {
                background-color: var(--vscode-list-hoverBackground);
            }

            .folder-icon, .file-icon {
                width: 16px;
                text-align: center;
            }

            .file-size {
                margin-left: auto;
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
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
                .package-content {
                    grid-template-columns: 1fr;
                }
                
                .package-header {
                    flex-direction: column;
                    text-align: center;
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
        `;
    }
}
