import * as vscode from 'vscode';
import { Finding } from '../api/reviewClient';

export class DiagnosticsManager {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private severityMap: { [key: string]: vscode.DiagnosticSeverity } = {
    critical: vscode.DiagnosticSeverity.Error,
    high: vscode.DiagnosticSeverity.Error,
    medium: vscode.DiagnosticSeverity.Warning,
    low: vscode.DiagnosticSeverity.Warning,
    info: vscode.DiagnosticSeverity.Information,
  };

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('code-review-ai');
  }

  setDiagnostics(uri: vscode.Uri, findings: Finding[]) {
    const diagnostics: vscode.Diagnostic[] = findings.map((finding) => {
      const line = Math.max(0, (finding.line_number || 1) - 1);
      const range = new vscode.Range(line, 0, line, 1000);

      const diagnostic = new vscode.Diagnostic(
        range,
        `${finding.title}: ${finding.description}`,
        this.severityMap[finding.severity] || vscode.DiagnosticSeverity.Warning
      );

      diagnostic.code = {
        value: finding.category,
        target: vscode.Uri.parse(`https://example.com/${finding.category}`),
      };

      diagnostic.source = 'Code Review AI';

      // Add suggestion as related information
      diagnostic.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(uri, range),
          `💡 ${finding.suggestion}`
        ),
      ];

      return diagnostic;
    });

    this.diagnosticCollection.set(uri, diagnostics);
  }

  clearDiagnostics(uri?: vscode.Uri) {
    if (uri) {
      this.diagnosticCollection.delete(uri);
    } else {
      this.diagnosticCollection.clear();
    }
  }

  dispose() {
    this.diagnosticCollection.dispose();
  }
}
