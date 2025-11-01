import * as vscode from 'vscode';
import { ReviewClient } from '../api/reviewClient';
import { DiagnosticsManager } from './diagnosticsManager';

export class MessageHandlers {
  constructor(
    private reviewClient: ReviewClient,
    private diagnosticsManager: DiagnosticsManager,
    private outputChannel: vscode.OutputChannel,
    private sendMessage: (message: any) => void
  ) {}

  /**
   * Handle generateFix command
   */
  async handleGenerateFix(message: any): Promise<void> {
    const { findingIndex, language, codeSnippet, description, suggestion, lineNumber } = message;

    this.log(
      `Generating fix for finding ${findingIndex} (line ${lineNumber ?? 'unknown'})`
    );

    this.sendMessage({
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

      this.sendMessage({
        type: 'fixGenerated',
        findingIndex,
        fix: result,
        lineNumber,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Fix generation error for finding ${findingIndex}: ${errorMessage}`);
      console.error('Fix generation error:', error);

      this.sendMessage({
        type: 'fixError',
        findingIndex,
        error: errorMessage,
        lineNumber,
      });
    }
  }

  /**
   * Handle applyFix command
   */
  async handleApplyFix(message: any): Promise<void> {
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
      const success = await this.applyFixToEditor(editor, fixCode, originalCode, lineNumber, true);
      if (!success) {
        vscode.window.showWarningMessage('Could not find code to replace');
      }
    } catch (error) {
      console.error('Apply fix error:', error);
      this.log(`Apply fix error: ${error instanceof Error ? error.message : 'unknown error'}`);
      vscode.window.showErrorMessage('Failed to apply fix');
    }
  }

  async handleGenerateFixAll(message: any): Promise<void> {
    const { language, findings } = message as {
      language: string;
      findings: Array<{
        findingIndex: number;
        codeSnippet: string;
        description: string;
        suggestion: string;
        lineNumber: number | null;
      }>;
    };

    if (!Array.isArray(findings) || findings.length === 0) {
      vscode.window.showWarningMessage('No findings available to auto-fix.');
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.log('Fix-all requested but no active editor was found');
      vscode.window.showErrorMessage('No active editor to apply fixes');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Applying AI fixes',
        cancellable: false,
      },
      async (progress) => {
        let applied = 0;
        const failures: string[] = [];

        for (let i = 0; i < findings.length; i++) {
          const finding = findings[i];
          progress.report({ message: `Fixing issue ${i + 1} of ${findings.length}` });

          try {
            const result = await this.reviewClient.generateFix(
              language,
              finding.codeSnippet,
              finding.description,
              finding.suggestion
            );

            if (result.success && result.fix_code) {
              const original = result.original ?? finding.codeSnippet;
              const success = await this.applyFixToEditor(
                editor,
                result.fix_code,
                original,
                finding.lineNumber,
                false
              );

              if (success) {
                applied++;
              } else {
                const msg = `Finding ${finding.findingIndex + 1}: could not locate code to replace`;
                failures.push(msg);
                this.log(msg);
              }
            } else {
              const msg = `Finding ${finding.findingIndex + 1}: ${result.error ?? 'failed to generate fix'}`;
              failures.push(msg);
              this.log(msg);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            const msg = `Finding ${finding.findingIndex + 1}: ${errorMessage}`;
            failures.push(msg);
            this.log(`Fix-all error for finding ${finding.findingIndex}: ${errorMessage}`);
          }
        }

        this.sendMessage({
          type: 'fixAllComplete',
          applied,
          total: findings.length,
          failures,
        });

        if (applied > 0) {
          vscode.window.showInformationMessage(
            `Auto-fix applied to ${applied} of ${findings.length} issues.`
          );
          this.log(`Fix-all applied to ${applied}/${findings.length} findings`);
          void vscode.commands.executeCommand('code-review-ai.reviewFile');
        } else {
          vscode.window.showWarningMessage('Unable to apply fixes automatically. See output for details.');
        }

        if (failures.length > 0) {
          failures.forEach((failure) => this.log(failure));
        }
      }
    );
  }

  /**
   * Handle clearDiagnostics command
   */
  handleClearDiagnostics(): void {
    this.diagnosticsManager.clearDiagnostics();
    this.sendMessage({ type: 'cleared' });
    this.log('Diagnostics cleared from webview command');
  }

  /**
   * Handle goToLine command
   */
  handleGoToLine(lineNumber: number): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !lineNumber) {
      return;
    }

    this.log(`Navigating to line ${lineNumber}`);
    const line = Math.max(0, lineNumber - 1);
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  private async applyFixToEditor(
    editor: vscode.TextEditor,
    fixCode: string,
    originalCode: string,
    lineNumber: number | null,
    notify: boolean
  ): Promise<boolean> {
    const snippet = originalCode && originalCode.trim().length > 0 ? originalCode : null;

    if (snippet) {
      const fullText = editor.document.getText();
      const startIndex = fullText.indexOf(snippet);

      if (startIndex !== -1) {
        const startPos = editor.document.positionAt(startIndex);
        const endPos = editor.document.positionAt(startIndex + snippet.length);
        const range = new vscode.Range(startPos, endPos);
        const success = await editor.edit((editBuilder) => {
          editBuilder.replace(range, fixCode);
        });

        if (success) {
          this.log('Fix applied using exact snippet match');
          if (notify) {
            vscode.window.showInformationMessage('✅ Fix applied successfully!');
          }
          return true;
        }
      }
    }

    if (lineNumber) {
      try {
        const line = editor.document.lineAt(Math.max(0, lineNumber - 1));
        const success = await editor.edit((editBuilder) => {
          editBuilder.replace(line.range, fixCode);
        });

        if (success) {
          this.log(`Fix applied by replacing line ${lineNumber}`);
          if (notify) {
            vscode.window.showInformationMessage('✅ Fix applied successfully!');
          }
          return true;
        }
      } catch (error) {
        this.log(`Line replacement failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    this.log('Fix apply failed: could not locate target code');
    if (notify) {
      vscode.window.showWarningMessage('Could not find code to replace');
    }
    return false;
  }
}
