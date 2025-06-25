import * as assert from 'assert';
import * as vscode from 'vscode';
import { LogLevel } from '../extension';

suite('Logging Test Suite', () => {
	vscode.window.showInformationMessage('Start logging tests.');

	test('LogLevel enum values are correct', () => {
		assert.strictEqual(LogLevel.Off, -1);
		assert.strictEqual(LogLevel.Error, 0);
		assert.strictEqual(LogLevel.Warn, 1);
		assert.strictEqual(LogLevel.Info, 2);
		assert.strictEqual(LogLevel.Verbose, 3);
		assert.strictEqual(LogLevel.Trace, 4);
	});

	test('Log levels are ordered correctly', () => {
		assert.strictEqual(LogLevel.Off < LogLevel.Error, true);
		assert.strictEqual(LogLevel.Error < LogLevel.Warn, true);
		assert.strictEqual(LogLevel.Warn < LogLevel.Info, true);
		assert.strictEqual(LogLevel.Info < LogLevel.Verbose, true);
		assert.strictEqual(LogLevel.Verbose < LogLevel.Trace, true);
	});
});