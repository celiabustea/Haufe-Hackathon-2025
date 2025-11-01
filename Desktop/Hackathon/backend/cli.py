#!/usr/bin/env python
"""
Command-line interface for automated code reviews
Usage: python cli.py --file <path> --language <lang>
"""

import asyncio
import argparse
import sys
from pathlib import Path
from app.services.ollama_service import OllamaService
from app.services.review_service import ReviewService


async def main():
    parser = argparse.ArgumentParser(description="Automated Code Review CLI")
    parser.add_argument("--file", "-f", help="File path to review")
    parser.add_argument("--language", "-l", help="Programming language (python, javascript, typescript, etc)")
    parser.add_argument("--model", "-m", default="mistral", help="Ollama model to use (default: mistral)")
    parser.add_argument("--guidelines", "-g", help="Custom guidelines file")
    parser.add_argument("--url", "-u", default="http://localhost:11434", help="Ollama API URL")
    parser.add_argument("--diff", "-d", action="store_true", help="Review git diff (staged changes)")
    parser.add_argument("--precommit", action="store_true", help="Pre-commit mode: review staged files and block if issues found")
    
    args = parser.parse_args()
    
    # Read file
    try:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"❌ File not found: {args.file}")
            sys.exit(1)
        
        code_content = file_path.read_text()
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)
    
    # Initialize services
    print(f"🔄 Initializing review service with model '{args.model}'...")
    ollama = OllamaService(model_name=args.model, base_url=args.url)
    
    # Check model availability
    available = await ollama.check_model_available()
    if not available:
        print(f"⚠️  Model '{args.model}' not found locally")
        print(f"   Attempting to pull {args.model}...")
        pulled = await ollama.pull_model()
        if not pulled:
            print("❌ Failed to pull model. Please run: ollama pull {args.model}")
            sys.exit(1)
    
    print("✓ Model ready")
    
    # Load custom guidelines if provided
    custom_guidelines = None
    if args.guidelines:
        try:
            guidelines_path = Path(args.guidelines)
            custom_guidelines = guidelines_path.read_text().strip().split("\n")
            custom_guidelines = [g.strip() for g in custom_guidelines if g.strip()]
        except Exception as e:
            print(f"⚠️  Could not load guidelines: {e}")
    
    # Perform review
    print(f"\n🔍 Reviewing {args.file}...")
    review_service = ReviewService(ollama)
    
    result = await review_service.review_code(
        code_content=code_content,
        language=args.language,
        file_path=str(args.file),
        custom_guidelines=custom_guidelines
    )
    
    # Display results
    print("\n" + "="*70)
    print(f"📄 CODE REVIEW REPORT: {result.file_path}")
    print("="*70)
    print(f"Language: {result.language}")
    print(f"Total Issues: {result.total_issues}")
    print("-"*70)
    
    if result.findings:
        # Group by severity
        findings_by_severity = {}
        for finding in result.findings:
            severity = finding.severity.value
            if severity not in findings_by_severity:
                findings_by_severity[severity] = []
            findings_by_severity[severity].append(finding)
        
        # Display findings
        for severity in ["critical", "high", "medium", "low", "info"]:
            if severity in findings_by_severity:
                print(f"\n{severity.upper()} ({len(findings_by_severity[severity])})")
                print("-"*70)
                for i, finding in enumerate(findings_by_severity[severity], 1):
                    print(f"{i}. {finding.title}")
                    print(f"   Category: {finding.category}")
                    if finding.line_number:
                        print(f"   Line: {finding.line_number}")
                    print(f"   {finding.description}")
                    print(f"   → {finding.suggestion}")
                    if finding.code_snippet:
                        print(f"   Code: {finding.code_snippet}")
                    print()
    else:
        print("✓ No issues found!")
    
    print("-"*70)
    print(f"Summary: {result.summary}")
    
    if result.token_usage:
        print(f"\nToken Usage:")
        print(f"  Prompt tokens: {result.token_usage.get('prompt_tokens', 0)}")
        print(f"  Completion tokens: {result.token_usage.get('completion_tokens', 0)}")
        print(f"  Total: {result.token_usage.get('total_tokens', 0)}")
    
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
