# AI Code Review - VS Code Extension

An AI-powered code review extension that integrates with your local Ollama LLM to analyze code for issues, security problems, and style violations directly in VS Code.

## Features

✨ **Instant Code Review**
- Right-click any code to review it instantly
- Review entire files or selected snippets
- Get findings with severity levels and actionable suggestions

🔍 **Smart Analysis**
- Detects style violations (PEP 8, Airbnb JS, etc.)
- Identifies security issues
- Finds performance problems
- Suggests architecture improvements
- Finds testing gaps

⚡ **Local & Private**
- Uses local Ollama LLM - no cloud, no data sharing
- Works completely offline
- Fast analysis on your machine

🎯 **Integrated Results**
- Inline diagnostics with squiggles
- Hover tooltips with suggestions
- Results panel with detailed findings
- Token usage tracking

## Requirements

1. **Ollama installed** - Download from https://ollama.ai
2. **LLM model pulled** - Run `ollama pull mistral`
3. **Backend running** - Start the Python backend at localhost:8000
4. **VS Code** - Version 1.85 or higher

## Getting Started

### 1. Start the Backend

```bash
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

Backend runs at `http://localhost:8000`

### 2. Install the Extension

- Open VS Code
- Go to Extensions (Ctrl+Shift+X)
- Search for "AI Code Review" and install
- Or install from folder: `code --install-extension ./extension`

### 3. Review Code

**Method 1: Right-click**
- Right-click on any code
- Select "Review This File" or "Review Selected Code"

**Method 2: Command Palette**
- Press Ctrl+Shift+P
- Search "Code Review" and select a command

**Method 3: Auto-review**
- Enable in settings: `code-review-ai.autoReviewOnSave`
- Code is reviewed automatically on save

## Configuration

Open Settings (Ctrl+,) and search for "code-review-ai":

- `backendUrl` - Backend API URL (default: `http://localhost:8000`)
- `autoReviewOnSave` - Auto-review on save (default: `false`)
- `showInlineFindings` - Show inline diagnostics (default: `true`)

## Supported Languages

- Python (PEP 8)
- JavaScript (Airbnb style)
- TypeScript
- Java
- C#
- C++
- Go
- Rust
- PHP
- Ruby

## Troubleshooting

**"Cannot connect to backend"**
- Make sure backend is running: `python main.py`
- Check backend URL in settings

**"Model not available"**
- Pull the model: `ollama pull mistral`
- Make sure Ollama is running

**No findings shown**
- Check VS Code output (View → Output)
- Verify backend health: curl http://localhost:8000/health

**Extension slow**
- First review loads the model (5-10 seconds)
- Subsequent reviews are faster (2-3 seconds)
- Consider using a smaller model: `ollama pull orca-mini`

## Commands

- `code-review-ai.reviewFile` - Review current file
- `code-review-ai.reviewSelection` - Review selected code
- `code-review-ai.showPanel` - Show review results panel
- `code-review-ai.settings` - Open extension settings

## Performance Tips

- Use `mistral` for balanced performance/quality
- Use `orca-mini` for speed (smaller model)
- Use `codellama` for code-optimized analysis
- Enable auto-review only if your system can handle it

## Privacy

✅ All code analysis happens locally
✅ No data sent to cloud
✅ No telemetry
✅ Complete privacy

## License

MIT

## Contributing

Issues and PRs welcome! Found a bug? Have a feature idea? Let us know.

---

**Happy reviewing!** 🚀
