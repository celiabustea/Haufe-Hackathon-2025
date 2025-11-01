/**
 * Generates the HTML content for the Code Review WebView
 */
export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Review Dashboard</title>
    <style>
        ${getStyles()}
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
        
        <!-- Debug banner (will be hidden once working) -->
        <div id="debugBanner" style="background: rgba(255,165,0,0.2); padding: 8px; margin-bottom: 12px; border-radius: 4px; font-size: 11px; font-family: monospace;">
            🐛 Debug: <span id="debugStatus">Initializing...</span>
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
        ${getScript()}
    </script>
</body>
</html>`;
}

function getStyles(): string {
  return `
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
        }

        /* HEADER */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: linear-gradient(135deg, rgba(100, 150, 255, 0.1), rgba(76, 175, 80, 0.1));
            border-radius: 10px;
            border: 1px solid var(--vscode-panel-border);
            margin-bottom: 20px;
        }

        .title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 16px;
            font-weight: 600;
        }

        .title span {
            font-size: 20px;
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
            margin-bottom: 16px;
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
            margin-bottom: 16px;
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
            margin-bottom: 12px;
        }

        .findings-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
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
            color: var(--vscode-foreground);
            padding: 8px 10px;
            background: rgba(76, 175, 80, 0.15);
            border-left: 3px solid #4ec9b0;
            border-radius: 4px;
            margin: 8px 0;
            line-height: 1.4;
        }

        .finding-best-practice {
            display: flex;
            gap: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 8px 10px;
            background: rgba(76, 175, 80, 0.1);
            border-left: 3px solid #4ec9b0;
            border-radius: 4px;
            margin: 8px 0;
            line-height: 1.4;
        }

        .finding-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        .action-btn {
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
        }

        .action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }

        /* EMPTY STATE */
        .empty {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .empty-text {
            font-size: 14px;
            line-height: 1.6;
        }

        /* LOADING */
        .loading {
            text-align: center;
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--vscode-panel-border);
            border-top-color: var(--vscode-focusBorder);
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
            margin-bottom: 16px;
        }

        /* BUTTONS */
        .button-group {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
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
            margin-bottom: 16px;
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
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .modal-btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .fix-loading {
            display: flex;
            align-items: center;
            gap: 12px;
            justify-content: center;
            padding: 20px;
        }
  `;
}

function getScript(): string {
  return `
        const vscode = acquireVsCodeApi();
        let currentReview = null;
        let activeFilters = new Set(['critical', 'high', 'medium', 'low']);
        let pendingFix = null;
        let messageCount = 0;
        
        function updateDebug(msg) {
            const debugEl = document.getElementById('debugStatus');
            if (debugEl) {
                messageCount++;
                debugEl.textContent = '[' + messageCount + '] ' + msg;
            }
        }

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
                let activeFilters = new Set(['critical', 'high', 'medium', 'low', 'info']);
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

        window.generateFixFromEncoded = function(findingIndex, encodedLanguage, encodedCodeSnippet, encodedDescription, encodedSuggestion, lineNumber) {
            const language = decodeURIComponent(encodedLanguage);
            const codeSnippet = decodeURIComponent(encodedCodeSnippet);
            const description = decodeURIComponent(encodedDescription);
            const suggestion = decodeURIComponent(encodedSuggestion);
            window.generateFix(findingIndex, language, codeSnippet, description, suggestion, lineNumber);
        };

        window.fixAll = function() {
            if (!currentReview || !Array.isArray(currentReview.findings)) {
                alert('No review results available yet. Please run a review first.');
                return;
            }

            const payload = currentReview.findings
                .map((f, idx) => ({
                    findingIndex: idx,
                    codeSnippet: f.code_snippet || f.description,
                    description: f.description,
                    suggestion: f.suggestion,
                    lineNumber: f.line_number ?? null,
                }))
                .filter(f => f.codeSnippet && f.codeSnippet.trim().length > 0);

            if (payload.length === 0) {
                alert('No findings with code snippets are available for auto-fix.');
                return;
            }

            vscode.postMessage({
                command: 'generateFixAll',
                language: currentReview.language,
                findings: payload,
            });
        };

        window.addEventListener('message', (event) => {
            const message = event.data;
            console.log('WebView received message:', message.type, message);
            updateDebug('Received: ' + message.type);
            
            try {
                switch (message.type) {
                    case 'reviewStarted':
                        console.log('Processing reviewStarted');
                        updateDebug('Processing reviewStarted');
                        updateStatus(false, 'Analyzing...');
                        const contentDiv = document.getElementById('content');
                        if (contentDiv) {
                            contentDiv.innerHTML = '<div class="loading"><div class="spinner"></div><span>Analyzing your code...</span></div>';
                        }
                        break;
                    case 'reviewComplete':
                        console.log('===== REVIEW COMPLETE MESSAGE RECEIVED =====');
                        console.log('Message object:', message);
                        console.log('Review object:', message.review);
                        console.log('Findings array:', message.review?.findings);
                        console.log('Findings count:', message.review?.findings?.length);
                        updateDebug('reviewComplete received with ' + (message.review?.findings?.length || 0) + ' findings');
                        
                        if (!message.review) {
                            console.error('ERROR: No review object in reviewComplete message');
                            updateDebug('ERROR: No review object');
                            document.getElementById('content').innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Error: No review data received</div></div>';
                            break;
                        }
                        
                        currentReview = message.review;
                        updateStatus(true, 'Review Complete');
                        updateDebug('Rendering review...');
                        renderReview(message.review);
                        updateDebug('✅ Render complete!');
                        console.log('Review rendering complete');
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
                case 'fixAllComplete':
                    const summary = 'Auto-fix completed. Applied ' + message.applied + ' of ' + message.total + ' fixes.';
                    if (message.failures && message.failures.length > 0) {
                        console.warn('Fix-all failures:', message.failures);
                    }
                    alert(summary);
                    break;
                }
            } catch (error) {
                console.error('Error processing message:', error);
                console.error('Message was:', message);
            }
        });

        function renderReview(review) {
            console.log('===== renderReview called =====');
            console.log('Review object:', JSON.stringify(review, null, 2));
            console.log('Findings count:', review?.findings?.length);
            
            const contentDiv = document.getElementById('content');
            if (!contentDiv) {
                console.error('content div not found');
                return;
            }

            if (!review || !review.findings || review.findings.length === 0) {
                console.warn('No findings to display');

                contentDiv.innerHTML = '<div class="empty"><div class="empty-icon">✨</div><div class="empty-text"><strong>Excellent!</strong><div style="font-size: 12px; margin-top: 8px;">No issues found</div></div></div>';
                return;
            }

            const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
            review.findings.forEach(f => {
                if (severityCounts.hasOwnProperty(f.severity)) severityCounts[f.severity]++;
            });

            const scoreHtml = '<div class="score-card"><div class="score-info"><h3>Issues Found</h3><div class="score-counts">' +
                (severityCounts.critical > 0 ? '<div class="count-badge">🔴 ' + severityCounts.critical + ' Critical</div>' : '') +
                (severityCounts.high > 0 ? '<div class="count-badge">🟠 ' + severityCounts.high + ' High</div>' : '') +
                (severityCounts.medium > 0 ? '<div class="count-badge">🟡 ' + severityCounts.medium + ' Medium</div>' : '') +
                (severityCounts.low > 0 ? '<div class="count-badge">🔵 ' + severityCounts.low + ' Low</div>' : '') +
                (severityCounts.info > 0 ? '<div class="count-badge">ℹ️ ' + severityCounts.info + ' Info</div>' : '') +
                '</div></div><div class="score-value">' + review.findings.length + '</div></div>';

            const filterHtml = '<div class="filter-bar">' +
                '<button class="filter-btn ' + (activeFilters.has('critical') ? 'active' : '') + '" onclick="window.toggleFilter(\'critical\')">🔴 Critical</button>' +
                '<button class="filter-btn ' + (activeFilters.has('high') ? 'active' : '') + '" onclick="window.toggleFilter(\'high\')">🟠 High</button>' +
                '<button class="filter-btn ' + (activeFilters.has('medium') ? 'active' : '') + '" onclick="window.toggleFilter(\'medium\')">🟡 Medium</button>' +
                '<button class="filter-btn ' + (activeFilters.has('low') ? 'active' : '') + '" onclick="window.toggleFilter(\'low\')">🔵 Low</button>' +
                '<button class="filter-btn ' + (activeFilters.has('info') ? 'active' : '') + '" onclick="window.toggleFilter(\'info\')">ℹ️ Info</button>' +
                '</div>';

            const filteredFindings = review.findings.filter(f => activeFilters.has(f.severity));
            const fixableCount = filteredFindings.filter(f => (f.code_snippet || '').trim().length > 0).length;

            const findingsHtml = filteredFindings.map((f, idx) => {
                const lineInfo = f.line_number ? '<div class="finding-line">Line ' + f.line_number + '</div>' : '';
                const reasonInfo = f.severity_reason ? '<div class="finding-reason">ℹ️ <strong>Why:</strong> ' + (f.severity_reason || '') + '</div>' : '';
                const bestPractice = f.best_practice ? '<div class="finding-best-practice">✅ <strong>Best Practice:</strong> ' + (f.best_practice || '') + '</div>' : '';
                const languageSafe = encodeURIComponent((review.language || 'unknown').toString());
                const snippetSafe = encodeURIComponent((f.code_snippet || f.description || '').toString());
                const descriptionSafe = encodeURIComponent((f.description || '').toString());
                const suggestionSafe = encodeURIComponent((f.suggestion || '').toString());
                const lineNumberValue = f.line_number != null ? f.line_number : 'null';
                return '<div class="finding ' + f.severity + '"><div class="finding-header"><div class="finding-title">' + f.title + '</div>' + lineInfo +
                    '</div><div class="finding-meta"><span class="badge badge-severity">' + f.severity + '</span><span class="badge badge-category">' + f.category + '</span></div>' +
                    '<div class="finding-description">' + f.description + '</div>' + reasonInfo +
                    '<div class="finding-suggestion"><span>💡 ' + f.suggestion + '</span></div>' + bestPractice +
                    '<div class="finding-actions"><button class="action-btn" onclick="vscode.postMessage({command: \\'goToLine\\', line: ' + (f.line_number || 0) + '})">📍 Go to Line</button>' +
                    '<button class="action-btn" onclick="window.generateFixFromEncoded(' + idx + ', \\'" + languageSafe + "\\', \\'" + snippetSafe + "\\', \\'" + descriptionSafe + "\\', \\'" + suggestionSafe + "\\', ' + lineNumberValue + ')">' + (f.code_snippet ? '🔧 Auto-fix' : '💭 Suggest Fix') + '</button></div></div>';
            }).join('');

            const tokenHtml = review.token_usage ? '<div class="stats"><div class="stat-card"><div class="stat-value">' + review.token_usage.prompt_tokens +
                '</div><div class="stat-label">Prompt</div></div><div class="stat-card"><div class="stat-value">' + review.token_usage.completion_tokens +
                '</div><div class="stat-label">Completion</div></div><div class="stat-card"><div class="stat-value">' + review.token_usage.total_tokens +
                '</div><div class="stat-label">Total</div></div></div>' : '';

            const buttonHtml = '<div class="button-group">' +
                '<button class="primary-btn" onclick="vscode.postMessage({command: \\'reReview\\'})">🔄 Re-run</button>' +
                '<button class="primary-btn" onclick="vscode.postMessage({command: \\'reviewStaged\\'})">🚀 Review Staged</button>' +
                (fixableCount > 0 ? '<button class="primary-btn" onclick="window.fixAll()">🛠️ Fix All</button>' : '') +
                '<button class="primary-btn" onclick="vscode.postMessage({command: \\'clearDiagnostics\\'})">❌ Clear</button>' +
                '</div>';

            contentDiv.innerHTML = scoreHtml + filterHtml + '<div class="findings-header">Findings (' + filteredFindings.length + ')</div>' +
                '<div class="findings-list">' + findingsHtml + '</div><div class="summary">' + (review.summary || '') + '</div>' + tokenHtml + buttonHtml;
            
            console.log('Review rendered successfully');
        }

        window.toggleFilter = toggleFilter;

                // Log that script loaded and notify extension webview is ready
                vscode.postMessage({ command: 'log', data: 'WebView script loaded successfully' });
                // Notify extension that the webview is ready to receive messages
                vscode.postMessage({ command: 'webviewReady' });
  `;
}
