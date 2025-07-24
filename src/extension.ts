import { sanitizeLog } from './sanitizeLog';
import * as vscode from 'vscode';
import { NuGetPackageEditorProvider } from './packageEditorProvider';
import { Logger, createLoggerFromConfig, getLogContentsForChannel } from '@timheuer/vscode-ext-logger';

// Global output channel for logging
let logger: Logger;

// Export the logger instance and type for use by other modules
export { logger, Logger };
let packageEditorProvider: NuGetPackageEditorProvider | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Initialize logger
	const channelName = context.extension.packageJSON.displayName;

	logger = createLoggerFromConfig(channelName, 'nupkg-viewer', 'logLevel', 'info', true, context);
	logger.info('Extension "nupkg-viewer" is activating...');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "nupkg-viewer" is now active!');
	logger.trace('Extension activation started');

	try {        // Register the custom editor provider for .nupkg files
        logger.trace('Registering custom editor provider...');
        const { registration: editorProviderRegistration, provider } = NuGetPackageEditorProvider.register(context);
        context.subscriptions.push(editorProviderRegistration);
        
        // Store reference to the provider for cleanup
        packageEditorProvider = provider;
        logger.trace('Custom editor provider registered successfully');

		// Register the view package command
		logger.trace('Registering viewPackage command...');
		const viewPackageCommand = vscode.commands.registerCommand('nupkg-viewer.viewPackage', async (uri?: vscode.Uri) => {
			logger.trace(`viewPackage command executed with URI: ${uri?.toString() || 'none'}`);
			try {
				let fileUri: vscode.Uri;
				
				if (uri) {
					fileUri = uri;
					logger.trace(`Using provided URI: ${fileUri.toString()}`);
				} else {
					logger.trace('No URI provided, showing file picker...');
					// If no URI provided, ask user to select a .nupkg file
					const result = await vscode.window.showOpenDialog({
						canSelectFiles: true,
						canSelectFolders: false,
						canSelectMany: false,
						filters: {
							'NuGet Packages': ['nupkg']
						}
					});
					
					if (!result || result.length === 0) {
						logger.trace('User cancelled file selection');
						return;
					}
					
					fileUri = result[0];
					logger.trace(`User selected file: ${fileUri.toString()}`);
				}

				// Open the file with our custom editor
				logger.info(`Opening file with custom editor: ${fileUri.toString()}`);
				await vscode.commands.executeCommand('vscode.openWith', fileUri, 'nupkg-viewer.packageEditor');
				logger.trace('File opened successfully with custom editor');
				
			} catch (error) {
				const errorMessage = `Failed to open package: ${error instanceof Error ? error.message : 'Unknown error'}`;
				logger.error('Error in viewPackage command', error instanceof Error ? error : undefined);
				vscode.window.showErrorMessage(errorMessage);
			}
		});

		// Register the open package viewer command
		logger.trace('Registering openPackageViewer command...');
		const openPackageViewerCommand = vscode.commands.registerCommand('nupkg-viewer.openPackageViewer', async () => {
			logger.trace('openPackageViewer command executed');
			// This command allows users to select and view any .nupkg file
			await vscode.commands.executeCommand('nupkg-viewer.viewPackage');
		});

		const decorationProvider = vscode.window.registerFileDecorationProvider({
			provideFileDecoration: (uri: vscode.Uri) => {
				// Sanitize the path before logging
				const sanitizedPath = sanitizeLog(uri.fsPath);
				logger.trace(`Checking file decoration for: ${sanitizedPath}`);
				if (uri.fsPath.endsWith('.nupkg')) {
					logger.trace(`Applying decoration to .nupkg file: ${sanitizedPath}`);
					return {
						badge: '📦',
						color: new vscode.ThemeColor('editorInfo.foreground'),
						tooltip: 'NuGet Package'
					};
				}
				return undefined;
			}
		});

		vscode.workspace.getConfiguration().update(
			'workbench.editorAssociations',
			{
				'*.nupkg': 'nupkg-viewer.packageEditor'
			},
			vscode.ConfigurationTarget.Global
		);

		context.subscriptions.push(viewPackageCommand);
		context.subscriptions.push(openPackageViewerCommand);
		context.subscriptions.push(decorationProvider);
		logger.trace('All commands registered successfully');

		// Register the reportIssue command
		logger.trace('Registering reportIssue command...');
		const reportIssueCommand = vscode.commands.registerCommand('nupkg-viewer.reportIssue', async () => {
			logger.trace('reportIssue command executed');
			try {
				let logContents = '';
				try {
					// Get the log contents from the logger's output channel
					logger.trace('Attempting to read log file contents');
					const logResult = await getLogContentsForChannel(context.extension.packageJSON.displayName, context);

					if (logResult.success && logResult.contents) {
						logger.trace('Log file read successfully');
						logContents = logResult.contents;
					} else {
						logger.error('Failed to read log file', logResult.error);
						logContents = `Log file could not be read. Please check the Output panel -> ${channelName} for log information.`;
					}
				} catch (logError) {
					logger.warn('Could not read log file, using fallback message', logError instanceof Error ? logError : undefined);
					logContents = `Log file could not be read. Please check the Output panel -> ${channelName} for log information.`;
				}

				const sanitizedLog = sanitizeLog(logContents);
				const wrappedLog = `<details><summary>Log Output</summary>\n\n<pre>${sanitizedLog}</pre>\n\n</details>`;
				await vscode.commands.executeCommand('vscode.openIssueReporter', {
					extensionId: 'timheuer.nupkg-viewer',
					data: wrappedLog
				});
				logger.trace('Issue reporter opened with sanitized log output as data');
			} catch (error) {
				logger.error('Error opening issue reporter', error instanceof Error ? error : undefined);
				vscode.window.showErrorMessage('Failed to open issue reporter');
			}
		});
		context.subscriptions.push(reportIssueCommand);

		logger.trace('Extension activation completed successfully');
	} catch (error) {
		logger.error('Failed to activate extension', error instanceof Error ? error : undefined);
		throw error;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	logger.trace('Extension "nupkg-viewer" is deactivating...');
	
	// Clean up the package editor provider
	if (packageEditorProvider) {
		packageEditorProvider.dispose();
		packageEditorProvider = undefined;
	}

	if (logger) {
		logger.dispose();
	}
}
