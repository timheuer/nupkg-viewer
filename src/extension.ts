// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { NuGetPackageEditorProvider } from './packageEditorProvider';
import { NuGetPackageParser } from './packageParser';

// Global output channel for logging
let outputChannel: vscode.OutputChannel;

export function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('NuGet Package Viewer');
	}
	return outputChannel;
}

// Logging utility functions
export function logInfo(message: string): void {
	const timestamp = new Date().toISOString();
	getOutputChannel().appendLine(`[INFO ${timestamp}] ${message}`);
}

export function logError(message: string, error?: Error): void {
	const timestamp = new Date().toISOString();
	getOutputChannel().appendLine(`[ERROR ${timestamp}] ${message}`);
	if (error) {
		getOutputChannel().appendLine(`[ERROR ${timestamp}] ${error.stack || error.message}`);
	}
}

export function logWarning(message: string): void {
	const timestamp = new Date().toISOString();
	getOutputChannel().appendLine(`[WARNING ${timestamp}] ${message}`);
}

export function logDebug(message: string): void {
	const timestamp = new Date().toISOString();
	getOutputChannel().appendLine(`[DEBUG ${timestamp}] ${message}`);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Initialize output channel
	getOutputChannel();
	logInfo('Extension "nupkg-viewer" is activating...');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "nupkg-viewer" is now active!');
	logInfo('Extension activation started');

	try {
		// Register the custom editor provider for .nupkg files
		logInfo('Registering custom editor provider...');
		const editorProvider = NuGetPackageEditorProvider.register(context);
		context.subscriptions.push(editorProvider);
		logInfo('Custom editor provider registered successfully');

		// Register the view package command
		logInfo('Registering viewPackage command...');
		const viewPackageCommand = vscode.commands.registerCommand('nupkg-viewer.viewPackage', async (uri?: vscode.Uri) => {
			logInfo(`viewPackage command executed with URI: ${uri?.toString() || 'none'}`);
			try {
				let fileUri: vscode.Uri;
				
				if (uri) {
					fileUri = uri;
					logInfo(`Using provided URI: ${fileUri.toString()}`);
				} else {
					logInfo('No URI provided, showing file picker...');
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
						logInfo('User cancelled file selection');
						return;
					}
					
					fileUri = result[0];
					logInfo(`User selected file: ${fileUri.toString()}`);
				}

				// Open the file with our custom editor
				logInfo(`Opening file with custom editor: ${fileUri.toString()}`);
				await vscode.commands.executeCommand('vscode.openWith', fileUri, 'nupkg-viewer.packageEditor');
				logInfo('File opened successfully with custom editor');
				
			} catch (error) {
				const errorMessage = `Failed to open package: ${error instanceof Error ? error.message : 'Unknown error'}`;
				logError('Error in viewPackage command', error instanceof Error ? error : undefined);
				vscode.window.showErrorMessage(errorMessage);
			}
		});

		// Register the open package viewer command
		logInfo('Registering openPackageViewer command...');
		const openPackageViewerCommand = vscode.commands.registerCommand('nupkg-viewer.openPackageViewer', async () => {
			logInfo('openPackageViewer command executed');
			// This command allows users to select and view any .nupkg file
			await vscode.commands.executeCommand('nupkg-viewer.viewPackage');
		});

		context.subscriptions.push(viewPackageCommand);
		context.subscriptions.push(openPackageViewerCommand);
		logInfo('All commands registered successfully');

		// Show a welcome message
		logInfo('Showing welcome message');
		vscode.window.showInformationMessage('NuGet Package Viewer is ready! Right-click on any .nupkg file to view it.');
		
		logInfo('Extension activation completed successfully');
	} catch (error) {
		logError('Failed to activate extension', error instanceof Error ? error : undefined);
		throw error;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	logInfo('Extension "nupkg-viewer" is deactivating...');
	if (outputChannel) {
		outputChannel.dispose();
	}
}
