import * as vscode from 'vscode';
import { ReviewProvider } from './providers/reviewProvider';
import { DiagnosticsManager } from './providers/diagnosticsManager';
import { ReviewClient } from './api/reviewClient';

let reviewProvider: ReviewProvider;
let diagnosticsManager: DiagnosticsManager;
let reviewClient: ReviewClient;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
	try {
		console.log('🚀 CODE REVIEW AI EXTENSION ACTIVATED');

		// Create output channel for fast feedback
		outputChannel = vscode.window.createOutputChannel('AI Code Review');

		const config = vscode.workspace.getConfiguration('code-review-ai');
		const backendUrl = config.get<string>('backendUrl') || 'http://localhost:8000';

		// Initialize services
		reviewClient = new ReviewClient(backendUrl);
		diagnosticsManager = new DiagnosticsManager();
		reviewProvider = new ReviewProvider(reviewClient, diagnosticsManager);

		console.log('Services initialized');

		// Register Review File command
		context.subscriptions.push(
			vscode.commands.registerCommand('code-review-ai.reviewFile', async () => {
				console.log('Review File command triggered');
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					await reviewProvider.reviewFile(editor);
				} else {
					vscode.window.showWarningMessage('No active editor');
				}
			})
		);

		// Register Review Selection command
		context.subscriptions.push(
			vscode.commands.registerCommand('code-review-ai.reviewSelection', async () => {
				console.log('Review Selection command triggered');
				const editor = vscode.window.activeTextEditor;
				if (editor && !editor.selection.isEmpty) {
					await reviewProvider.reviewSelection(editor);
				}
			})
		);

		// Register Show Panel command
		context.subscriptions.push(
			vscode.commands.registerCommand('code-review-ai.showPanel', async () => {
				console.log('Show Panel command triggered');
				reviewProvider.showPanel();
			})
		);

		// Register Settings command
		context.subscriptions.push(
			vscode.commands.registerCommand('code-review-ai.settings', () => {
				console.log('Settings command triggered');
				vscode.commands.executeCommand('workbench.action.openSettings', 'code-review-ai');
			})
		);

		// Register Review Staged Changes command (Pre-commit)
		context.subscriptions.push(
			vscode.commands.registerCommand('code-review-ai.reviewStaged', async () => {
				console.log('Review Staged Changes command triggered');
				reviewProvider.showPanel();
				// Simulate the webview message
				await (reviewProvider as any).handleReviewStaged();
			})
		);

		// Register view provider
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('code-review-panel', reviewProvider)
		);

		console.log('Commands registered');

		// Show notification
		vscode.window.showInformationMessage('✅ AI Code Review Ready! Press Ctrl+Alt+R to review code');
		console.log('✅ AI Code Review extension fully activated');
	} catch (error) {
		console.error('❌ Error activating extension:', error);
		vscode.window.showErrorMessage(`Code Review Error: ${error}`);
	}
}

export function deactivate() {
	console.log('Code Review AI extension deactivated');
}
