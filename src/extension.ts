// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { NuGetPackageEditorProvider } from './packageEditorProvider';
import { NuGetPackageParser } from './packageParser';

// Global output channel for logging
let outputChannel: vscode.LogOutputChannel;

// Log level constants
export enum LogLevel {
	Off = -1,
	Error = 0,
	Warn = 1,
	Info = 2,
	Verbose = 3
}

// Map string config values to LogLevel enum
const logLevelMap: { [key: string]: LogLevel } = {
	'off': LogLevel.Off,
	'error': LogLevel.Error,
	'warn': LogLevel.Warn,
	'info': LogLevel.Info,
	'verbose': LogLevel.Verbose
};

export function getOutputChannel(): vscode.LogOutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('NuGet Package Viewer', { log: true });
	}
	return outputChannel;
}

// Get the current log level from configuration
function getCurrentLogLevel(): LogLevel {
	const config = vscode.workspace.getConfiguration('nupkg-viewer');
	const logLevelString = config.get<string>('logLevel', 'info');
	return logLevelMap[logLevelString] ?? LogLevel.Info;
}

// Check if a message should be logged based on current log level
function shouldLog(messageLevel: LogLevel): boolean {
	const currentLevel = getCurrentLogLevel();
	// If logging is off, don't log anything
	if (currentLevel === LogLevel.Off) {
		return false;
	}
	return messageLevel <= currentLevel;
}

// Logging utility functions
export function logInfo(message: string): void {
	if (!shouldLog(LogLevel.Info)) {
		return;
	}
	getOutputChannel().info(message);
}

export function logError(message: string, error?: Error): void {
	if (!shouldLog(LogLevel.Error)) {
		return;
	}
	getOutputChannel().error(message);
	if (error) {
		getOutputChannel().error(error.stack || error.message);
	}
}

export function logWarning(message: string): void {
	if (!shouldLog(LogLevel.Warn)) {
		return;
	}
	getOutputChannel().warn(message);
}

export function logDebug(message: string): void {
	if (!shouldLog(LogLevel.Verbose)) {
		return;
	}
	getOutputChannel().debug(message);
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
