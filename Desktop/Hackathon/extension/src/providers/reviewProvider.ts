import * as vscode from 'vscode';
import { ReviewClient, ReviewResponse } from '../api/reviewClient';
import { DiagnosticsManager } from './diagnosticsManager';
import { MessageHandlers } from './messageHandlers';
import { getWebviewContent } from './webviewContent';

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
  private messageHandlers: MessageHandlers;

  constructor(
    private reviewClient: ReviewClient,
    private diagnosticsManager: DiagnosticsManager
  ) {
    this.outputChannel = vscode.window.createOutputChannel('AI Code Review');
    this.messageHandlers = new MessageHandlers(
      this.reviewClient,
      this.diagnosticsManager,
      this.outputChannel,
      (message) => this.sendMessageToWebview(message)
    );
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
    webviewView.webview.html = getWebviewContent();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message: any) => {
      this.handleWebviewMessage(message);
    });

    // Log that webview is ready
    this.log('WebView resolved and ready');

    // If we already have a review, send it to the newly opened webview
    if (this.currentReview) {
      this.log('Webview opened with existing review, sending data...');
      setTimeout(() => {
        this.sendMessageToWebview({
          type: 'reviewComplete',
          review: this.currentReview,
        });
      }, 200);
    }
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
   * Display comprehensive review output in OUTPUT panel
   */
  private displayComprehensiveReview(review: ReviewResponse, filePath: string, language: string): void {
    this.log('\n' + '='.repeat(100));
    this.log('║' + ' '.repeat(98) + '║');
    this.log('║' + ' CODE REVIEW COMPLETE '.padStart(60).padEnd(98) + '║');
    this.log('║' + ' '.repeat(98) + '║');
    this.log('='.repeat(100));
    
    this.log(`\n📄 File: ${filePath}`);
    this.log(`💬 Language: ${language}`);
    
    // Token usage
    if (review.token_usage) {
      this.log(`\n🔢 TOKEN USAGE:`);
      this.log(`   • Prompt Tokens:     ${review.token_usage.prompt_tokens || 0}`);
      this.log(`   • Completion Tokens: ${review.token_usage.completion_tokens || 0}`);
      this.log(`   • Total Tokens:      ${review.token_usage.total_tokens || 0}`);
    }
    
    // Summary
    const severityCounts: any = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    let totalEffort = 0;
    
    if (review.findings) {
      review.findings.forEach(finding => {
        severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
        if (finding.effort_minutes) {
          totalEffort += finding.effort_minutes;
        }
      });
    }
    
    this.log(`\n📊 SUMMARY:`);
    this.log(`   • Total Issues: ${review.total_issues}`);
    this.log(`   • Critical:     ${severityCounts.critical}`);
    this.log(`   • High:         ${severityCounts.high}`);
    this.log(`   • Medium:       ${severityCounts.medium}`);
    this.log(`   • Low:          ${severityCounts.low}`);
    this.log(`   • Info:         ${severityCounts.info}`);
    
    if (totalEffort > 0) {
      const hours = Math.floor(totalEffort / 60);
      const mins = totalEffort % 60;
      this.log(`   • Estimated Effort: ${hours}h ${mins}m (${totalEffort} minutes)`);
    }
    
    // Detailed findings
    if (review.findings && review.findings.length > 0) {
      this.log(`\n${'='.repeat(100)}`);
      this.log('DETAILED FINDINGS');
      this.log('='.repeat(100));
      
      review.findings.forEach((finding, idx) => {
        const icons: any = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🔵',
          info: '⚪'
        };
        const icon = icons[finding.severity] || '⚪';
        
        this.log(`\n${icon} Finding #${idx + 1}: ${finding.title}`);
        this.log(`   Severity: ${finding.severity.toUpperCase()}`);
        if (finding.line_number) {
          this.log(`   Line: ${finding.line_number}`);
        }
        this.log(`   Category: ${finding.category}`);
        
        // Description
        this.log(`\n   📝 Description:`);
        finding.description.split('\n').forEach(line => {
          if (line.trim()) {
            this.log(`      ${line.trim()}`);
          }
        });
        
        // Severity reason
        if (finding.severity_reason) {
          this.log(`\n   ❓ Why ${finding.severity}?`);
          finding.severity_reason.split('\n').forEach(line => {
            if (line.trim()) {
              this.log(`      ${line.trim()}`);
            }
          });
        }
        
        // Suggestion
        this.log(`\n   💡 Suggestion:`);
        finding.suggestion.split('\n').forEach(line => {
          if (line.trim()) {
            this.log(`      ${line.trim()}`);
          }
        });
        
        // Best practice
        if (finding.best_practice) {
          this.log(`\n   ✅ Best Practice:`);
          finding.best_practice.split('\n').forEach(line => {
            if (line.trim()) {
              this.log(`      ${line.trim()}`);
            }
          });
        }
        
        // Dimensions
        if (finding.dimensions && typeof finding.dimensions === 'object') {
          this.log(`\n   📊 Multi-Dimensional Analysis (0-10 scale):`);
          Object.entries(finding.dimensions).forEach(([key, value]) => {
            const barLength = Math.min(10, Math.max(0, Number(value) || 0));
            const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
            this.log(`      ${key.padEnd(20)} [${bar}] ${value}/10`);
          });
        }
        
        // Effort
        if (finding.effort_minutes) {
          const hours = Math.floor(finding.effort_minutes / 60);
          const mins = finding.effort_minutes % 60;
          if (hours > 0) {
            this.log(`\n   ⏱️  Estimated Effort: ${hours}h ${mins}m`);
          } else {
            this.log(`\n   ⏱️  Estimated Effort: ${mins} minutes`);
          }
        }
        
        // Documentation
        if (finding.documentation_link) {
          this.log(`\n   🔗 Documentation: ${finding.documentation_link}`);
        }
        
        // Examples
        if (finding.examples && Array.isArray(finding.examples)) {
          this.log(`\n   📖 Examples:`);
          finding.examples.slice(0, 2).forEach(example => {
            this.log(`      • ${example}`);
          });
        }
        
        // Code snippet
        if (finding.code_snippet) {
          this.log(`\n   ⚠️  Problematic Code:`);
          finding.code_snippet.split('\n').forEach(line => {
            this.log(`      ${line}`);
          });
        }
        
        // Fix code
        if (finding.fix_code) {
          this.log(`\n   ✨ Suggested Fix:`);
          finding.fix_code.split('\n').forEach(line => {
            this.log(`      ${line}`);
          });
        }
        
        this.log(`\n   ${'-'.repeat(96)}`);
      });
    } else {
      this.log(`\n✅ No issues found! Code looks good.`);
    }
    
    this.log(`\n${'='.repeat(100)}`);
    this.log('END OF REVIEW');
    this.log('='.repeat(100) + '\n');
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

      this.log(`Review API returned ${review.findings?.length ?? 0} findings`);
      
      // Display comprehensive review output
      this.displayComprehensiveReview(review, filePath, language);
      
      // Log token usage
      if (review.token_usage) {
        this.log(`\nToken Usage - Prompt: ${review.token_usage.prompt_tokens}, Completion: ${review.token_usage.completion_tokens}, Total: ${review.token_usage.total_tokens}`);
      }

      if (this.currentFileUri) {
        this.log(`Setting diagnostics for ${review.findings?.length ?? 0} findings`);
        this.diagnosticsManager.setDiagnostics(this.currentFileUri, review.findings);
      }

      this.log('Sending reviewComplete message to webview');
      console.log('Full review object being sent to webview:', JSON.stringify(review, null, 2));
      
      // Ensure webview is visible and ready
      if (this.webviewView) {
        this.webviewView.show?.(true);
        
        // Small delay to ensure webview is ready to receive messages
        setTimeout(() => {
          this.log('Attempting to send reviewComplete message...');
          this.sendMessageToWebview({
            type: 'reviewComplete',
            review: review,
          });
          this.log('reviewComplete message posted to webview');
        }, 150);
      } else {
        this.log('WARNING: webviewView is null, cannot send reviewComplete');
      }

      const issueText = review.total_issues === 1 ? 'issue' : 'issues';
      this.log(`Review complete: found ${review.total_issues} ${issueText}`);
      
      // Show tokens in notification if available
      const tokenInfo = review.token_usage 
        ? ` (${review.token_usage.total_tokens} tokens)`
        : '';
      vscode.window.showInformationMessage(
        `✅ Code Review Complete: Found ${review.total_issues} ${issueText}${tokenInfo}`
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
    // Log ALL messages from webview for debugging
    this.log(`Received message from webview: ${message.command || message.type || 'unknown'}`);
    
    switch (message.command) {
      case 'clearDiagnostics':
        this.messageHandlers.handleClearDiagnostics();
        break;

      case 'goToLine':
        this.messageHandlers.handleGoToLine(message.line);
        break;

      case 'reReview':
        this.log('Re-running review from webview command');
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          this.reviewFile(activeEditor);
        }
        break;

      case 'generateFix':
        void this.messageHandlers.handleGenerateFix(message);
        break;

      case 'applyFix':
        void this.messageHandlers.handleApplyFix(message);
        break;

      case 'generateFixAll':
        void this.messageHandlers.handleGenerateFixAll(message);
        break;

      case 'reviewStaged':
        void this.handleReviewStaged();
        break;

      case 'webviewReady':
        this.log('✅ Received webviewReady from webview - webview script is loaded!');
        // If we have a cached review, send it now
        if (this.currentReview) {
          this.log(`Sending cached review to webview on ready (${this.currentReview.findings?.length || 0} findings)`);
          setTimeout(() => {
            this.sendMessageToWebview({ type: 'reviewComplete', review: this.currentReview });
          }, 50);
        } else {
          this.log('No cached review available to send');
        }
        break;

      case 'log':
        this.log(`[WebView Console] ${message.data}`);
        break;
        
      default:
        this.log(`Unknown webview message command: ${message.command}`);
    }
  }

  /**
   * Send message to webview
   */
  private sendMessageToWebview(message: any): void {
    if (!this.webviewView) {
      this.log(`Cannot send message ${message.type}: webview not initialized`);
      return;
    }
    this.log(`Sending message to webview: ${message.type}`);
    try {
      this.webviewView.webview.postMessage(message);
      this.log(`Message ${message.type} sent successfully`);
    } catch (error) {
      this.log(`Error sending message: ${error}`);
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
   * Review staged changes (pre-commit style)
   */
  private async handleReviewStaged(): Promise<void> {
    try {
      this.log('Running pre-commit review on staged files...');
      
      // Get git extension
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found');
        return;
      }

      const git = gitExtension.getAPI(1);
      const repositories = git.repositories;
      
      if (repositories.length === 0) {
        vscode.window.showWarningMessage('No git repository found');
        return;
      }

      const repo = repositories[0];
      const staged = repo.state.indexChanges;

      if (staged.length === 0) {
        vscode.window.showInformationMessage('No staged changes to review');
        return;
      }

      this.log(`Found ${staged.length} staged file(s)`);
      
      // Filter for supported file types
      const supportedExts = ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cs', '.cpp', '.go', '.rs', '.php', '.rb'];
      const filesToReview = staged.filter((change: any) => 
        supportedExts.some(ext => change.uri.fsPath.endsWith(ext))
      );

      if (filesToReview.length === 0) {
        vscode.window.showInformationMessage('No supported files in staged changes');
        return;
      }

      this.sendMessageToWebview({
        type: 'reviewStarted',
        message: `Reviewing ${filesToReview.length} staged file(s)...`,
      });

      let allFindings: any[] = [];
      let totalIssues = 0;
      let criticalCount = 0;
      let highCount = 0;

      for (const change of filesToReview) {
        this.log(`Reviewing staged file: ${change.uri.fsPath}`);
        
        const document = await vscode.workspace.openTextDocument(change.uri);
        const code = document.getText();
        const language = this.getLanguageId(document.languageId);
        
        const review = await this.reviewClient.reviewCode(code, language, change.uri.fsPath);
        
        if (review.findings) {
          allFindings = allFindings.concat(review.findings);
          totalIssues += review.total_issues;
          
          review.findings.forEach(f => {
            if (f.severity === 'critical') criticalCount++;
            if (f.severity === 'high') highCount++;
          });
        }
      }

      // Show combined results
      const combinedReview = {
        file_path: 'Staged Changes',
        language: 'multiple',
        findings: allFindings,
        summary: `Pre-commit review complete. Reviewed ${filesToReview.length} file(s). Found ${totalIssues} issue(s).`,
        total_issues: totalIssues,
        token_usage: null
      };

      this.sendMessageToWebview({
        type: 'reviewComplete',
        review: combinedReview,
      });

      // Warning if critical/high issues
      if (criticalCount > 0 || highCount > 0) {
        const msg = `⚠️ Pre-commit Review: Found ${criticalCount} critical and ${highCount} high severity issues in staged files`;
        vscode.window.showWarningMessage(msg, 'View Issues', 'Commit Anyway')
          .then(choice => {
            if (choice === 'View Issues') {
              this.showPanel();
            }
          });
      } else {
        vscode.window.showInformationMessage(`✅ Pre-commit Review: ${totalIssues} issue(s) found in staged files`);
      }

      this.log(`Pre-commit review complete: ${totalIssues} total issues`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Pre-commit review error: ${errorMessage}`);
      vscode.window.showErrorMessage(`Pre-commit Review Error: ${errorMessage}`);
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}
