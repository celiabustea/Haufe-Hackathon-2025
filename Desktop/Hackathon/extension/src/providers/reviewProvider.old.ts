import * as vscode from 'vscode';
import { ReviewClient, ReviewResponse, Finding } from '../api/reviewClient';
import { DiagnosticsManager } from './diagnosticsManager';

/**
 * Provides WebView UI for code review results
 * Implements VSCode WebviewViewProvider for the code-review-panel view
 */
export class ReviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'code-review-panel';
  private webviewView?: vscode.WebviewView;
  private currentReview?: ReviewResponse;
  private currentFileUri?: vscode.Uri;
    private outputChannel: vscode.OutputChannel;

  constructor(
    private reviewClient: ReviewClient,
    private diagnosticsManager: DiagnosticsManager
    ) {
        this.outputChannel = vscode.window.createOutputChannel('AI Code Review');
    }

  /**
   * Resolve webview view and set up event handlers
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    // Enable JavaScript in webview
    webviewView.webview.options = {
      enableScripts: true,
    };

    // Set initial HTML content
    this.updateWebviewContent();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message: any) => {
      this.handleWebviewMessage(message);
    });
  }

  /**
   * Review entire file
   */
  async reviewFile(editor: vscode.TextEditor): Promise<void> {
    const code = editor.document.getText();
    const language = this.getLanguageId(editor.document.languageId);
    const filePath = editor.document.fileName;
    this.currentFileUri = editor.document.uri;
    await this.performReview(code, language, filePath);
  }

  /**
   * Review selected code
   */
  async reviewSelection(editor: vscode.TextEditor): Promise<void> {
    const code = editor.document.getText(editor.selection);
    const language = this.getLanguageId(editor.document.languageId);
    const filePath = editor.document.fileName;
    this.currentFileUri = editor.document.uri;
    await this.performReview(code, language, filePath);
  }

  /**
   * Show the panel (bring to foreground)
   */
  showPanel(): void {
    if (this.webviewView) {
      this.webviewView.show?.();
    }
  }

  /**
   * Perform code review
   */
  private async performReview(
    code: string,
    language: string,
    filePath: string
  ): Promise<void> {
        try {
            this.outputChannel.show(true);
            this.log(`Review started for ${filePath} (${language})`);

            if (this.webviewView) {
                this.webviewView.show?.();
            }

            this.sendMessageToWebview({
                type: 'reviewStarted',
                message: 'Analyzing code...',
            });

            const review = await this.reviewClient.reviewCode(code, language, filePath);
            this.currentReview = review;

            if (this.currentFileUri) {
                this.diagnosticsManager.setDiagnostics(this.currentFileUri, review.findings);
            }

            this.sendMessageToWebview({
                type: 'reviewComplete',
                review: review,
            });

            const issueText = review.total_issues === 1 ? 'issue' : 'issues';
            this.log(`Review complete: found ${review.total_issues} ${issueText}`);
            vscode.window.showInformationMessage(
                `✅ Code Review Complete: Found ${review.total_issues} ${issueText}`
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Review error: ${errorMessage}`);
            console.error('Review error:', error);

            this.sendMessageToWebview({
                type: 'reviewError',
                error: errorMessage,
            });

            vscode.window.showErrorMessage(`Code Review Error: ${errorMessage}`);
        }
  }

  /**
   * Handle messages from webview
   */
    private handleWebviewMessage(message: any): void {
        switch (message.command) {
            case 'clearDiagnostics':
                this.diagnosticsManager.clearDiagnostics();
                this.sendMessageToWebview({ type: 'cleared' });
                this.log('Diagnostics cleared from webview command');
                break;

            case 'goToLine':
                this.goToLine(message.line);
                this.log(`Navigating to line ${message.line}`);
                break;

            case 'reReview':
                this.log('Re-running review from webview command');
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    this.reviewFile(activeEditor);
                }
                break;

            case 'generateFix':
                this.handleGenerateFix(message);
                break;

            case 'applyFix':
                this.handleApplyFix(message);
                break;

            case 'log':
                console.log('[WebView]', message.data);
                break;
        }
  }

    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

  /**
   * Navigate to specific line in editor
   */
  private goToLine(lineNumber: number | null): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !lineNumber) {
      return;
    }

    const line = Math.max(0, lineNumber - 1);
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

    /**
     * Generate fix for a finding
     */
    private async handleGenerateFix(message: any): Promise<void> {
        const { findingIndex, language, codeSnippet, description, suggestion, lineNumber } = message;

        this.log(
            `Generating fix for finding ${findingIndex} (line ${lineNumber ?? 'unknown'})`
        );

        this.sendMessageToWebview({
            type: 'fixGenerating',
            findingIndex,
        });

        try {
            const result = await this.reviewClient.generateFix(
                language,
                codeSnippet,
                description,
                suggestion
            );

            if (result.success) {
                this.log(`Fix generated successfully for finding ${findingIndex}`);
            } else {
                this.log(
                    `Fix generation returned failure for finding ${findingIndex}: ${result.error ?? 'unknown error'}`
                );
            }

            this.sendMessageToWebview({
                type: 'fixGenerated',
                findingIndex,
                fix: result,
                lineNumber,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Fix generation error for finding ${findingIndex}: ${errorMessage}`);
            console.error('Fix generation error:', error);

            this.sendMessageToWebview({
                type: 'fixError',
                findingIndex,
                error: errorMessage,
                lineNumber,
            });
        }
    }

  /**
   * Apply fix to editor
   */
  private handleApplyFix(message: any): void {
    const { fixCode, originalCode, lineNumber } = message;
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
            this.log('Apply fix requested but no active editor was found');
      vscode.window.showErrorMessage('No active editor to apply fix');
      return;
    }

        this.log(
            `Applying fix at line ${lineNumber ?? 'search'} (length ${fixCode?.length ?? 0} chars)`
        );

    try {
      editor.edit((editBuilder) => {
        const fullText = editor.document.getText();

        // Find and replace the original code
        if (fullText.includes(originalCode)) {
          const startIndex = fullText.indexOf(originalCode);
          const startPos = editor.document.positionAt(startIndex);
          const endPos = editor.document.positionAt(startIndex + originalCode.length);
          const range = new vscode.Range(startPos, endPos);

          editBuilder.replace(range, fixCode);
                    this.log('Fix applied using exact snippet match');
          vscode.window.showInformationMessage('✅ Fix applied successfully!');
        } else if (lineNumber) {
          // Fallback: replace entire line
          const line = editor.document.lineAt(lineNumber - 1);
          editBuilder.replace(line.range, fixCode);
                    this.log(`Fix applied by replacing line ${lineNumber}`);
          vscode.window.showInformationMessage('✅ Fix applied successfully!');
        } else {
                    this.log('Fix apply failed: could not locate target code');
          vscode.window.showWarningMessage('Could not find code to replace');
        }
      });
    } catch (error) {
      console.error('Apply fix error:', error);
            this.log(`Apply fix error: ${error instanceof Error ? error.message : 'unknown error'}`);
      vscode.window.showErrorMessage('Failed to apply fix');
    }
  }

  /**
   * Send message to webview
   */
  private sendMessageToWebview(message: any): void {
    this.webviewView?.webview.postMessage(message);
  }

  /**
   * Update webview content (call when needed to refresh)
   */
  private updateWebviewContent(): void {
    if (this.webviewView) {
      this.webviewView.webview.html = this.getWebviewContent();
    }
  }

  /**
   * Map VSCode language ID to backend language
   */
  private getLanguageId(vscodeLanguageId: string): string {
    const langMap: Record<string, string> = {
      python: 'python',
      javascript: 'javascript',
      typescript: 'typescript',
      javascriptreact: 'javascript',
      typescriptreact: 'typescript',
      java: 'java',
      csharp: 'csharp',
      cpp: 'cpp',
      c: 'cpp',
      go: 'go',
      rust: 'rust',
      php: 'php',
      ruby: 'ruby',
    };

    return langMap[vscodeLanguageId] || vscodeLanguageId;
  }

  /**
   * Generate webview HTML content
   */
  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Review Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            overflow-y: auto;
        }

        .container {
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        /* HEADER */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, rgba(100, 150, 255, 0.15), rgba(76, 175, 80, 0.15));
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--vscode-panel-border);
        }

        .title {
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--vscode-descriptionForeground);
        }

        .status-dot.success {
            background: #4ec9b0;
        }

        /* SCORE CARD */
        .score-card {
            background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(100, 150, 255, 0.2));
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--vscode-panel-border);
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 20px;
            align-items: center;
        }

        .score-info h3 {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .score-counts {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .count-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
            padding: 6px 12px;
            background: var(--vscode-badge-background);
            border-radius: 6px;
        }

        .score-value {
            font-size: 32px;
            font-weight: 700;
            color: var(--vscode-foreground);
        }

        /* FILTERS */
        .filter-bar {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .filter-btn {
            padding: 6px 14px;
            border-radius: 20px;
            border: 1px solid var(--vscode-panel-border);
            background: transparent;
            color: var(--vscode-foreground);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .filter-btn:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .filter-btn.active {
            background: var(--vscode-focusBorder);
            color: var(--vscode-editor-background);
        }

        /* FINDINGS */
        .findings-header {
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .findings-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .finding {
            padding: 14px;
            border-radius: 8px;
            border-left: 4px solid;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            transition: all 0.2s;
        }

        .finding:hover {
            transform: translateX(4px);
            background: var(--vscode-list-hoverBackground);
        }

        .finding.critical { border-left-color: #f14c4c; }
        .finding.high { border-left-color: #f48771; }
        .finding.medium { border-left-color: #dcdcaa; }
        .finding.low { border-left-color: #9cdcfe; }

        .finding-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
            gap: 12px;
        }

        .finding-title {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-foreground);
            flex: 1;
        }

        .finding-line {
            font-size: 11px;
            color: var(--vscode-foreground);
            background: var(--vscode-badge-background);
            padding: 4px 8px;
            border-radius: 4px;
            white-space: nowrap;
            font-weight: 500;
        }

        .finding-meta {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .badge-severity {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .badge-category {
            background: rgba(100, 150, 255, 0.2);
            color: #6db3f2;
            border: 1px solid rgba(100, 150, 255, 0.4);
        }

        .finding-description {
            font-size: 12px;
            color: var(--vscode-foreground);
            margin-bottom: 10px;
            line-height: 1.5;
            padding: 8px 10px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        .finding-reason {
            display: flex;
            gap: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 8px 10px;
            background: rgba(100, 100, 100, 0.1);
            border-left: 3px solid #9cdcfe;
            border-radius: 4px;
            margin: 8px 0;
            line-height: 1.4;
        }

        .finding-suggestion {
            display: flex;
            gap: 8px;
            font-size: 12px;
            color: #4ec9b0;
            padding: 10px;
            background: rgba(76, 175, 80, 0.1);
            border-left: 3px solid #4ec9b0;
            border-radius: 4px;
            line-height: 1.5;
        }

        .finding-best-practice {
            display: flex;
            gap: 8px;
            font-size: 11px;
            color: #6db3f2;
            padding: 8px 10px;
            background: rgba(76, 175, 80, 0.08);
            border-left: 3px solid #6db3f2;
            border-radius: 4px;
            margin: 8px 0;
            line-height: 1.4;
        }

        .finding-docs {
            font-size: 11px;
            padding: 6px 10px;
            margin: 8px 0;
        }

        .finding-docs a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }

        .finding-docs a:hover {
            text-decoration: underline;
        }

        .finding-actions {
            display: flex;
            gap: 8px;
            margin-top: 10px;
            flex-wrap: wrap;
        }

        .action-btn {
            padding: 4px 10px;
            font-size: 11px;
            background: transparent;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            color: var(--vscode-foreground);
            transition: all 0.2s;
        }

        .action-btn:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        /* EMPTY STATE */
        .empty {
            text-align: center;
            padding: 48px 24px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-icon {
            font-size: 56px;
            margin-bottom: 16px;
            opacity: 0.6;
        }

        .empty-text {
            font-size: 13px;
            line-height: 1.6;
        }

        /* LOADING */
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 48px 24px;
            color: var(--vscode-descriptionForeground);
        }

        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--vscode-descriptionForeground);
            border-top-color: var(--vscode-foreground);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* SUMMARY */
        .summary {
            padding: 14px 16px;
            background: linear-gradient(135deg, rgba(100, 150, 255, 0.08), rgba(76, 175, 80, 0.08));
            border-radius: 8px;
            font-size: 12px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            line-height: 1.6;
            color: var(--vscode-foreground);
        }

        /* BUTTONS */
        .button-group {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }

        .primary-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
        }

        .primary-btn:hover {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }

        /* STATS */
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }

        .stat-card {
            background: var(--vscode-badge-background);
            padding: 12px 16px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid var(--vscode-panel-border);
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--vscode-foreground);
        }

        .stat-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* MODAL */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
        }

        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h2 {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }

        .close-btn {
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
        }

        .close-btn:hover {
            opacity: 0.7;
        }

        .modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .diff-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
        }

        .diff-panel {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 12px;
        }

        .diff-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            display: block;
        }

        .diff-code {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            font-size: 11px;
            background: rgba(0, 0, 0, 0.2);
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.5;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
        }

        .diff-code.original {
            border-left: 3px solid #f14c4c;
        }

        .diff-code.fixed {
            border-left: 3px solid #4ec9b0;
        }

        .modal-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        .modal-btn {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .modal-btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .modal-btn.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .modal-btn.secondary {
            background: transparent;
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-foreground);
        }

        .modal-btn.secondary:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .fix-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            gap: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">
                <span>🔍</span>
                Code Review Dashboard
            </div>
            <div class="status">
                <span class="status-dot" id="statusDot"></span>
                <span id="statusText">Ready</span>
            </div>
        </div>

        <div id="content" class="empty">
            <div class="empty-icon">📝</div>
            <div class="empty-text">
                <div>Press <strong>Ctrl+Alt+R</strong> to review code</div>
                <div style="font-size: 11px; margin-top: 12px; opacity: 0.7;">or right-click and select "Review This File"</div>
            </div>
        </div>
    </div>

    <div id="fixModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔧 Auto-Fix Preview</h2>
                <button class="close-btn" onclick="window.closeFixModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div id="fixModalBody"></div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" onclick="window.closeFixModal()">Cancel</button>
                <button class="modal-btn primary" onclick="window.confirmApplyFix()">✅ Apply Fix</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentReview = null;
        let activeFilters = new Set(['critical', 'high', 'medium', 'low']);
        let pendingFix = null;

        function updateStatus(isDone, text) {
            const dot = document.getElementById('statusDot');
            const txt = document.getElementById('statusText');
            if (isDone) {
                dot.classList.add('success');
            } else {
                dot.classList.remove('success');
            }
            if (txt) txt.textContent = text;
        }

        function toggleFilter(severity) {
            if (activeFilters.has(severity)) {
                activeFilters.delete(severity);
            } else {
                activeFilters.add(severity);
            }
            if (currentReview) {
                renderReview(currentReview);
            }
        }

        window.closeFixModal = function() {
            const modal = document.getElementById('fixModal');
            if (modal) modal.classList.remove('show');
            pendingFix = null;
        };

        window.confirmApplyFix = function() {
            if (pendingFix) {
                vscode.postMessage({
                    command: 'applyFix',
                    fixCode: pendingFix.fixed,
                    originalCode: pendingFix.original,
                    lineNumber: pendingFix.lineNumber,
                });
                window.closeFixModal();
            }
        };

        function showFixModal(original, fixed, lineNumber) {
            pendingFix = { original, fixed, lineNumber };
            const modal = document.getElementById('fixModal');
            const modalBody = document.getElementById('fixModalBody');
            
            if (!fixed) {
                modalBody.innerHTML = '<div class="fix-loading"><div class="spinner"></div><span>Generating fix...</span></div>';
            } else {
                const escapeHtml = (text) => {
                    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
                    return text.replace(/[&<>"']/g, m => map[m]);
                };
                modalBody.innerHTML = '<div class="diff-container"><div><span class="diff-label">Original Code</span><div class="diff-code original">' + escapeHtml(original) + '</div></div><div><span class="diff-label">Fixed Code</span><div class="diff-code fixed">' + escapeHtml(fixed) + '</div></div></div>';
            }
            
            modal.classList.add('show');
        }

        window.generateFix = function(findingIndex, language, codeSnippet, description, suggestion, lineNumber) {
            showFixModal(codeSnippet, null, lineNumber);
            vscode.postMessage({
                command: 'generateFix',
                findingIndex: findingIndex,
                language: language,
                codeSnippet: codeSnippet,
                description: description,
                suggestion: suggestion,
                lineNumber: lineNumber,
            });
        };

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'reviewStarted':
                    updateStatus(false, 'Analyzing...');
                    document.getElementById('content').innerHTML = '<div class="loading"><div class="spinner"></div><span>Analyzing your code...</span></div>';
                    break;
                case 'reviewComplete':
                    currentReview = message.review;
                    updateStatus(true, 'Review Complete');
                    renderReview(message.review);
                    break;
                case 'reviewError':
                    updateStatus(false, 'Error');
                    document.getElementById('content').innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Error: ' + (message.error || 'Unknown error') + '</div></div>';
                    break;
                case 'fixGenerated':
                    if (message.fix && message.fix.success) {
                        const line = message.lineNumber ?? (pendingFix ? pendingFix.lineNumber : null);
                        showFixModal(message.fix.original, message.fix.fix_code, line);
                        if (pendingFix) {
                            pendingFix.fixed = message.fix.fix_code;
                            pendingFix.lineNumber = line;
                        }
                    } else {
                        alert('Failed to generate fix: ' + (message.fix && message.fix.error || 'Unknown error'));
                    }
                    break;
                case 'fixError':
                    alert('Error generating fix: ' + message.error);
                    window.closeFixModal();
                    break;
            }
        });

        function renderReview(review) {
            const contentDiv = document.getElementById('content');
            if (!contentDiv) return;

            if (review.findings.length === 0) {
                contentDiv.innerHTML = '<div class="empty"><div class="empty-icon">✨</div><div class="empty-text"><strong>Excellent!</strong><div style="font-size: 12px; margin-top: 8px;">No issues found</div></div></div>';
                return;
            }

            const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
            review.findings.forEach(f => {
                if (severityCounts.hasOwnProperty(f.severity)) severityCounts[f.severity]++;
            });

            const scoreHtml = '<div class="score-card"><div class="score-info"><h3>Issues Found</h3><div class="score-counts">' +
                (severityCounts.critical > 0 ? '<div class="count-badge">🔴 ' + severityCounts.critical + ' Critical</div>' : '') +
                (severityCounts.high > 0 ? '<div class="count-badge">🟠 ' + severityCounts.high + ' High</div>' : '') +
                (severityCounts.medium > 0 ? '<div class="count-badge">🟡 ' + severityCounts.medium + ' Medium</div>' : '') +
                (severityCounts.low > 0 ? '<div class="count-badge">🔵 ' + severityCounts.low + ' Low</div>' : '') +
                '</div></div><div class="score-value">' + review.findings.length + '</div></div>';

            const filterHtml = '<div class="filter-bar">' +
                '<button class="filter-btn ' + (activeFilters.has('critical') ? 'active' : '') + '" onclick="window.toggleFilter(\'critical\')">🔴 Critical</button>' +
                '<button class="filter-btn ' + (activeFilters.has('high') ? 'active' : '') + '" onclick="window.toggleFilter(\'high\')">🟠 High</button>' +
                '<button class="filter-btn ' + (activeFilters.has('medium') ? 'active' : '') + '" onclick="window.toggleFilter(\'medium\')">🟡 Medium</button>' +
                '<button class="filter-btn ' + (activeFilters.has('low') ? 'active' : '') + '" onclick="window.toggleFilter(\'low\')">🔵 Low</button>' +
                '</div>';

            const filteredFindings = review.findings.filter(f => activeFilters.has(f.severity));

            const findingsHtml = filteredFindings.map((f, idx) => {
                const lineInfo = f.line_number ? '<div class="finding-line">Line ' + f.line_number + '</div>' : '';
                const reasonInfo = f.severity_reason ? '<div class="finding-reason">ℹ️ <strong>Why:</strong> ' + (f.severity_reason || '') + '</div>' : '';
                const bestPractice = f.best_practice ? '<div class="finding-best-practice">✅ <strong>Best Practice:</strong> ' + (f.best_practice || '') + '</div>' : '';
                return '<div class="finding ' + f.severity + '"><div class="finding-header"><div class="finding-title">' + f.title + '</div>' + lineInfo +
                    '</div><div class="finding-meta"><span class="badge badge-severity">' + f.severity + '</span><span class="badge badge-category">' + f.category + '</span></div>' +
                    '<div class="finding-description">' + f.description + '</div>' + reasonInfo +
                    '<div class="finding-suggestion"><span>💡 ' + f.suggestion + '</span></div>' + bestPractice +
                    '<div class="finding-actions"><button class="action-btn" onclick="vscode.postMessage({command: \'goToLine\', line: ' + (f.line_number || 0) + '})">📍 Go to Line</button>' +
                    '<button class="action-btn" onclick="window.generateFix(' + idx + ', \'' + (review.language || 'unknown') + '\', ' + JSON.stringify(f.code_snippet || f.description) + ', ' + JSON.stringify(f.description) + ', ' + JSON.stringify(f.suggestion) + ')">' + (f.code_snippet ? '🔧 Auto-fix' : '💭 Suggest Fix') + '</button></div></div>';
            }).join('');

            const tokenHtml = review.token_usage ? '<div class="stats"><div class="stat-card"><div class="stat-value">' + review.token_usage.prompt_tokens +
                '</div><div class="stat-label">Prompt</div></div><div class="stat-card"><div class="stat-value">' + review.token_usage.completion_tokens +
                '</div><div class="stat-label">Completion</div></div><div class="stat-card"><div class="stat-value">' + review.token_usage.total_tokens +
                '</div><div class="stat-label">Total</div></div></div>' : '';

            contentDiv.innerHTML = scoreHtml + filterHtml + '<div class="findings-header">Findings (' + filteredFindings.length + ')</div>' +
                '<div class="findings-list">' + findingsHtml + '</div><div class="summary">' + (review.summary || '') + '</div>' + tokenHtml +
                '<div class="button-group"><button class="primary-btn" onclick="vscode.postMessage({command: \'reReview\'})">🔄 Re-run</button>' +
                '<button class="primary-btn" onclick="vscode.postMessage({command: \'clearDiagnostics\'})">❌ Clear</button></div>';
        }

        window.toggleFilter = toggleFilter;

        // Log that script loaded
        vscode.postMessage({ command: 'log', data: 'WebView script loaded successfully' });
    </script>
</body>
</html>`;
  }
}
