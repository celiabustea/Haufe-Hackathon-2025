from typing import List, Optional
import json
import re
from app.models.review import Finding, ReviewResponse, SeverityLevel
from app.services.ollama_service import OllamaService


class ReviewService:
    """Service to perform code reviews using LLM"""
    
    LANGUAGE_GUIDELINES = {
        "python": [
            "Follow PEP 8 style guide (max 79 chars per line for code)",
            "Use meaningful, descriptive variable names (snake_case)",
            "Add type hints for function signatures and complex logic",
            "Avoid mutable default arguments (use None as default)",
            "Use context managers (with statement) for file/resource handling",
            "Import organization: stdlib, third-party, local (in order)",
            "Use docstrings for all modules, classes, and public functions",
            "Prefer list comprehensions over loops for simple transformations",
            "Use enumerate() when you need both index and value",
            "Avoid bare except clauses - catch specific exceptions",
            "Use f-strings for string formatting (Python 3.6+)"
        ],
        "javascript": [
            "Follow Airbnb JavaScript Style Guide",
            "Use const by default, let when reassignment needed",
            "Never use var - use const or let",
            "Use arrow functions for callbacks, avoid function keyword",
            "Handle promises with async/await, avoid callback hell",
            "Use template literals for string interpolation",
            "Add JSDoc comments for public functions",
            "Avoid side effects outside of functions",
            "Use destructuring for objects and arrays",
            "Validate user input and API responses",
            "Use === for comparison, never =="
        ],
        "typescript": [
            "Use strict TypeScript settings in tsconfig.json",
            "Avoid 'any' type - use specific types or generics",
            "Use interfaces for object contracts",
            "Use enums for fixed sets of constants",
            "Add explicit return type annotations to functions",
            "Use readonly for immutable properties",
            "Use access modifiers (public, private, protected) explicitly",
            "Prefer type over interface for unions/primitives",
            "Use generics for reusable type-safe components",
            "Add type guards for runtime type safety"
        ],
        "java": [
            "Follow Java naming conventions (CamelCase for classes)",
            "Use meaningful variable names (camelCase)",
            "Keep methods focused with single responsibility",
            "Add Javadoc comments for public classes and methods",
            "Use proper exception handling, never swallow exceptions",
            "Use try-with-resources for resource management",
            "Avoid null - use Optional or objects with defaults",
            "Use final for classes/methods that shouldn't be overridden",
            "Prefer composition over inheritance",
            "Use dependency injection for better testability"
        ],
        "csharp": [
            "Follow PascalCase for class and method names",
            "Use camelCase for local variables and parameters",
            "Add XML documentation comments (///) for public members",
            "Use null-coalescing operator (??) to handle nulls",
            "Use using statements for IDisposable objects",
            "Prefer async/await over callbacks",
            "Use LINQ for collection operations",
            "Use properties instead of public fields",
            "Add proper access modifiers (public, private, protected)",
            "Use const for values that never change"
        ],
        "cpp": [
            "Use meaningful variable and function names",
            "Add comments for complex algorithms",
            "Use RAII for resource management",
            "Avoid raw pointers - use smart pointers (unique_ptr, shared_ptr)",
            "Follow const correctness (const parameters and methods)",
            "Use references instead of pointers when possible",
            "Avoid global variables",
            "Use namespaces to avoid name collisions",
            "Add const to function parameters that shouldn't be modified",
            "Use standard algorithms and containers from STL"
        ],
        "go": [
            "Follow Go naming conventions (CamelCase for exports)",
            "Use error returns, not exceptions",
            "Add comments for all exported functions and types",
            "Keep functions small and focused",
            "Use interfaces for abstraction",
            "Avoid global variables",
            "Use defer for cleanup operations",
            "Prefer composition over inheritance",
            "Use go fmt for consistent formatting",
            "Handle errors explicitly - don't ignore them"
        ],
        "rust": [
            "Follow Rust naming conventions (snake_case for functions)",
            "Use meaningful variable names",
            "Add documentation comments (///) for public items",
            "Use Result/Option types instead of panicking",
            "Avoid unwrap() in production code - use ? operator",
            "Use lifetimes appropriately for borrowed references",
            "Prefer iterators over loops",
            "Use pattern matching instead of conditionals",
            "Add #[derive] attributes when appropriate",
            "Use tests with #[cfg(test)]"
        ],
        "php": [
            "Follow PSR-12 coding standard",
            "Use meaningful variable names (camelCase)",
            "Add type declarations for function parameters and returns",
            "Use type hints (int, string, array, etc.)",
            "Avoid global variables - use dependency injection",
            "Use proper exception handling",
            "Escape output properly to prevent XSS",
            "Validate and sanitize all user input",
            "Use prepared statements to prevent SQL injection",
            "Add PHPDoc comments for functions and classes"
        ],
        "ruby": [
            "Follow Ruby naming conventions (snake_case for methods)",
            "Use meaningful, descriptive variable names",
            "Keep methods small and focused",
            "Add comments using # for complex logic",
            "Use string interpolation (#{}) instead of concatenation",
            "Prefer symbols over strings for keys",
            "Use blocks and iterators instead of loops",
            "Add type hints in comments for clarity",
            "Avoid instance variables when not needed",
            "Use attr_reader, attr_writer, attr_accessor appropriately"
        ]
    }
    
    def __init__(self, ollama_service: OllamaService):
        self.ollama = ollama_service
    
    def get_system_prompt(self, language: str, custom_guidelines: Optional[List[str]] = None) -> str:
        """Generate system prompt for code review"""
        guidelines = custom_guidelines or self.LANGUAGE_GUIDELINES.get(language, [])
        guidelines_text = "\n".join([f"- {g}" for g in guidelines])
        
        return f"""You are a THOROUGH expert code reviewer for {language} code. Your role is to:
1. Find EVERY issue - analyze code for bugs, security issues, performance problems, and style issues
2. Identify ALL best practice violations - be comprehensive and thorough
3. Suggest improvements and refactoring opportunities
4. Rate severity (critical, high, medium, low, info)
5. Provide specific, actionable recommendations with code examples
6. Document findings with explanations and best practices
7. Estimate effort needed to fix each issue (in minutes)
8. Categorize issues across multiple dimensions: security, performance, style, architecture, testing, documentation

CRITICAL: Be THOROUGH. Review EVERY line. Look for:
- Shadowed built-ins (list, dict, str, etc.)
- Missing docstrings on ALL classes and functions
- Missing error handling (try/except, validation)
- Unclear variable names (x, data, result, etc.)
- Inefficient loops (use comprehensions, enumerate)
- Missing type hints
- Empty pass statements
- Magic numbers
- Potential runtime errors (division by zero, index errors)
- Security issues (input validation, SQL injection, etc.)

Guidelines to follow:
{guidelines_text}

Respond in JSON format with this structure:
{{
    "findings": [
        {{
            "line_number": <int or null>,
            "severity": "<critical|high|medium|low|info>",
            "category": "<style|performance|security|architecture|testing|documentation>",
            "title": "<short title>",
            "description": "<detailed description>",
            "suggestion": "<specific recommendation>",
            "code_snippet": "<relevant code excerpt or null>",
            "severity_reason": "<why this severity level>",
            "documentation_link": "<link to relevant docs or null>",
            "best_practice": "<what is the best practice alternative>",
            "examples": ["<example of bad pattern>", "<example of good pattern>"],
            "effort_minutes": <estimated minutes to fix (5-120)>,
            "dimensions": {{
                "security": <0-10 security impact>,
                "performance": <0-10 performance impact>,
                "maintainability": <0-10 maintainability impact>,
                "testing": <0-10 testability impact>
            }}
        }}
    ],
    "summary": "<overall assessment>",
    "total_issues": <number>
}}

Be thorough but concise. Always provide severity_reason, best_practice, effort_minutes and dimensions."""
    
    def parse_llm_response(self, response: str, file_path: str, language: str) -> ReviewResponse:
        """Parse LLM response and convert to ReviewResponse"""
        try:
            # Clean response - remove markdown code blocks if present
            original_response = response
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                if end > start:
                    response = response[start:end].strip()
            elif "```" in response:
                start = response.find("```") + 3
                end = response.find("```", start)
                if end > start:
                    response = response[start:end].strip()
                # Remove language identifier if present
                if response.startswith("json"):
                    response = response[4:].strip()
            
            # Try to find and extract JSON object
            start_idx = response.find('{')
            if start_idx == -1:
                print(f"ERROR: No JSON found in response")
                print(f"Response preview: {original_response[:500]}")
                return ReviewResponse(
                    file_path=file_path,
                    language=language,
                    findings=[],
                    summary="Could not find JSON in response",
                    total_issues=0
                )
            
            # Find the matching closing brace
            brace_count = 0
            end_idx = start_idx
            for i in range(start_idx, len(response)):
                if response[i] == '{':
                    brace_count += 1
                elif response[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
            
            json_str = response[start_idx:end_idx]
            
            print(f"\n{'='*80}")
            print(f"EXTRACTED JSON STRING (length: {len(json_str)} chars):")
            print(f"{'='*80}")
            print(json_str[:1000])
            if len(json_str) > 1000:
                print(f"\n... (middle {len(json_str) - 1200} chars omitted) ...\n")
                print(json_str[-200:])
            print(f"{'='*80}\n")
            
            # Try to parse JSON with aggressive fixes
            try:
                data = json.loads(json_str)
                print(f"✓ JSON parsed successfully!")
                print(f"  Findings in response: {len(data.get('findings', []))}")
            except json.JSONDecodeError as e:
                print(f"Initial JSON parse error: {e}")
                print(f"Attempting aggressive JSON fixes...")
                
                # Fix 1: Replace smart quotes with regular quotes
                json_str = json_str.replace('"', '"').replace('"', '"')
                json_str = json_str.replace("'", "'").replace("'", "'")
                
                # Fix 2: Escape unescaped quotes within string values
                # This regex finds quotes that are not properly escaped
                import re
                # Replace unescaped quotes inside JSON string values
                lines = json_str.split('\n')
                fixed_lines = []
                for line in lines:
                    # If line contains a string value with unescaped quotes
                    if '": "' in line or '":"' in line:
                        # Find the value part and escape quotes in it
                        parts = line.split('": "', 1)
                        if len(parts) == 2:
                            key_part = parts[0]
                            value_part = parts[1]
                            # Find the closing quote of the value
                            if '",' in value_part or '"}' in value_part:
                                # Split at the closing quote
                                value_end = value_part.rfind('",')
                                if value_end == -1:
                                    value_end = value_part.rfind('"}')
                                if value_end > 0:
                                    value_content = value_part[:value_end]
                                    rest = value_part[value_end:]
                                    # Escape quotes in the value content
                                    value_content = value_content.replace('"', '\\"')
                                    line = key_part + '": "' + value_content + rest
                    fixed_lines.append(line)
                json_str = '\n'.join(fixed_lines)
                
                try:
                    data = json.loads(json_str)
                    print(f"✓ JSON fixed and parsed!")
                    print(f"  Findings in response: {len(data.get('findings', []))}")
                except json.JSONDecodeError as e2:
                    print(f"JSON still invalid after fixes: {e2}")
                    print(f"Problematic JSON (first 500 chars): {json_str[:500]}")
                    print(f"Problematic JSON (last 200 chars): {json_str[-200:]}")
                    # Return empty result with error details
                    return ReviewResponse(
                        file_path=file_path,
                        language=language,
                        findings=[],
                        summary=f"JSON parsing failed: {str(e2)}. Response may be truncated.",
                        total_issues=0
                    )
            
            findings = []
            for f in data.get("findings", []):
                try:
                    finding = Finding(
                        line_number=f.get("line_number"),
                        severity=SeverityLevel(f.get("severity", "info")),
                        category=f.get("category", "other"),
                        title=f.get("title", ""),
                        description=f.get("description", ""),
                        suggestion=f.get("suggestion", ""),
                        code_snippet=f.get("code_snippet"),
                        fix_code=f.get("fix_code"),
                        documentation_link=f.get("documentation_link"),
                        severity_reason=f.get("severity_reason"),
                        examples=f.get("examples"),
                        best_practice=f.get("best_practice"),
                        effort_minutes=f.get("effort_minutes"),
                        dimensions=f.get("dimensions")
                    )
                    findings.append(finding)
                except Exception as e:
                    print(f"Error parsing finding: {e}")
                    continue
            
            return ReviewResponse(
                file_path=file_path,
                language=language,
                findings=findings,
                summary=data.get("summary", "Review complete"),
                total_issues=len(findings)
            )
        except Exception as e:
            print(f"JSON parsing error: {e}")
            print(f"Response was: {response[:200]}")
            return ReviewResponse(
                file_path=file_path,
                language=language,
                findings=[],
                summary=f"Error parsing review: {str(e)}",
                total_issues=0
            )
    
    async def review_code(self, code_content: str, language: str, file_path: str, 
                         custom_guidelines: Optional[List[str]] = None) -> ReviewResponse:
        """
        Perform code review on provided code
        """
        system_prompt = self.get_system_prompt(language, custom_guidelines)
        
        user_prompt = f"""Review this {language} code LINE BY LINE. You MUST find AT LEAST 5-10 issues if they exist.

MANDATORY CHECKS FOR EVERY FUNCTION/CLASS:
✓ Does it shadow built-ins? (list, dict, str, sum, etc.)
✓ Does it have a docstring?
✓ Does it have error handling?
✓ Are variable names descriptive?
✓ Are there type hints?
✓ Could it raise exceptions? (division by zero, index errors)
✓ Is the code efficient? (avoid range(len()), use enumerate)
✓ Are there empty pass statements?
✓ Are there magic numbers?

Code to review:
{code_content}

CRITICAL: For EVERY finding, you MUST provide:
1. code_snippet: Extract 2-5 lines showing the problematic code
2. fix_code: Provide the corrected version of that code snippet

BE THOROUGH. Find MULTIPLE issues per function if they exist.

Return ONLY valid JSON (no markdown, no extra text):
{{
    "findings": [
        {{
            "line_number": 3,
            "severity": "medium",
            "category": "style",
            "title": "Issue title",
            "description": "What's wrong",
            "suggestion": "How to fix",
            "code_snippet": "def bad_function(list):\\n    return list[0]",
            "fix_code": "def good_function(items):\\n    \"\"\"Get first item from list.\"\"\"\\n    return items[0] if items else None",
            "severity_reason": "Why this matters",
            "documentation_link": null,
            "best_practice": "Better approach",
            "examples": ["Bad: old way", "Good: new way"],
            "effort_minutes": 10,
            "dimensions": {{"security": 3, "performance": 5, "maintainability": 7, "testing": 4}}
        }}
    ],
    "summary": "Overall assessment",
    "total_issues": 1
}}"""
        
        # Generate review using LLM
        llm_response = await self.ollama.generate_review(
            prompt=user_prompt,
            system_prompt=system_prompt
        )
        
        print(f"\n{'='*80}")
        print(f"RAW LLM RESPONSE:")
        print(f"{'='*80}")
        print(llm_response.get("response", "NO RESPONSE")[:1000])
        print(f"{'='*80}\n")
        
        if llm_response.get("error"):
            return ReviewResponse(
                file_path=file_path,
                language=language,
                findings=[],
                summary=llm_response.get("response", "Error during review"),
                total_issues=0
            )
        
        # Parse response
        response_text = llm_response.get("response", "")
        print(f"\n{'='*60}")
        print(f"LLM RAW RESPONSE (first 800 chars):")
        print(response_text[:800])
        print(f"{'='*60}\n")
        
        review = self.parse_llm_response(
            response_text,
            file_path,
            language
        )
        
        print(f"Parsed findings count: {len(review.findings)}")
        for i, f in enumerate(review.findings[:3]):
            print(f"Finding {i+1}: {f.title} (line {f.line_number})")
        
        # Add token usage info
        review.token_usage = {
            "prompt_tokens": llm_response.get("prompt_eval_count", 0),
            "completion_tokens": llm_response.get("eval_count", 0),
            "total_tokens": llm_response.get("total_tokens", 0)
        }
        
        # Print comprehensive terminal output
        self._print_comprehensive_review(review, language)
        
        return review
    
    def _print_comprehensive_review(self, review: ReviewResponse, language: str):
        """Print comprehensive formatted review output to terminal"""
        print("\n" + "="*100)
        print("║" + " "*98 + "║")
        print("║" + " CODE REVIEW COMPLETE ".center(98) + "║")
        print("║" + " "*98 + "║")
        print("="*100)
        
        # File and language info
        print(f"\n📄 File: {review.file_path}")
        print(f"💬 Language: {language}")
        
        # Token usage
        if review.token_usage:
            print(f"\n🔢 TOKEN USAGE:")
            print(f"   • Prompt Tokens:     {review.token_usage.get('prompt_tokens', 0):,}")
            print(f"   • Completion Tokens: {review.token_usage.get('completion_tokens', 0):,}")
            print(f"   • Total Tokens:      {review.token_usage.get('total_tokens', 0):,}")
        
        # Findings summary
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        total_effort = 0
        
        for finding in review.findings:
            severity_counts[finding.severity.value] += 1
            if finding.effort_minutes:
                total_effort += finding.effort_minutes
        
        print(f"\n📊 SUMMARY:")
        print(f"   • Total Issues: {review.total_issues}")
        print(f"   • Critical:     {severity_counts['critical']}")
        print(f"   • High:         {severity_counts['high']}")
        print(f"   • Medium:       {severity_counts['medium']}")
        print(f"   • Low:          {severity_counts['low']}")
        print(f"   • Info:         {severity_counts['info']}")
        if total_effort > 0:
            hours = total_effort // 60
            mins = total_effort % 60
            print(f"   • Estimated Effort: {hours}h {mins}m ({total_effort} minutes)")
        
        # Guideline awareness
        if language in self.LANGUAGE_GUIDELINES:
            print(f"\n📚 GUIDELINE AWARENESS:")
            guidelines = self.LANGUAGE_GUIDELINES[language]
            print(f"   Applied guidelines for {language}:")
            for guideline in guidelines[:3]:  # Show first 3
                print(f"   • {guideline}")
            if len(guidelines) > 3:
                print(f"   • ... and {len(guidelines) - 3} more")
        
        # Detailed findings
        if review.findings:
            print(f"\n" + "="*100)
            print("DETAILED FINDINGS")
            print("="*100)
            
            for idx, finding in enumerate(review.findings, 1):
                # Header with severity icon
                severity_icons = {
                    "critical": "🔴",
                    "high": "🟠",
                    "medium": "🟡",
                    "low": "🔵",
                    "info": "⚪"
                }
                icon = severity_icons.get(finding.severity.value, "⚪")
                
                print(f"\n{icon} Finding #{idx}: {finding.title}")
                print(f"   Severity: {finding.severity.value.upper()}")
                if finding.line_number:
                    print(f"   Line: {finding.line_number}")
                print(f"   Category: {finding.category}")
                
                # Description
                print(f"\n   📝 Description:")
                for line in finding.description.split('\n'):
                    if line.strip():
                        print(f"      {line.strip()}")
                
                # Severity reason
                if finding.severity_reason:
                    print(f"\n   ❓ Why {finding.severity.value}?")
                    for line in finding.severity_reason.split('\n'):
                        if line.strip():
                            print(f"      {line.strip()}")
                
                # Suggestion
                print(f"\n   💡 Suggestion:")
                for line in finding.suggestion.split('\n'):
                    if line.strip():
                        print(f"      {line.strip()}")
                
                # Best practice
                if finding.best_practice:
                    print(f"\n   ✅ Best Practice:")
                    for line in finding.best_practice.split('\n'):
                        if line.strip():
                            print(f"      {line.strip()}")
                
                # Multi-dimensional scores
                if finding.dimensions:
                    print(f"\n   📊 Multi-Dimensional Analysis (0-10 scale):")
                    dims = finding.dimensions
                    if isinstance(dims, dict):
                        for key, value in dims.items():
                            bar_length = int(value) if isinstance(value, (int, float)) else 0
                            bar = "█" * bar_length + "░" * (10 - bar_length)
                            print(f"      {key.capitalize():20s} [{bar}] {value}/10")
                
                # Effort estimation
                if finding.effort_minutes:
                    hours = finding.effort_minutes // 60
                    mins = finding.effort_minutes % 60
                    if hours > 0:
                        print(f"\n   ⏱️  Estimated Effort: {hours}h {mins}m")
                    else:
                        print(f"\n   ⏱️  Estimated Effort: {mins} minutes")
                
                # Documentation link
                if finding.documentation_link:
                    print(f"\n   🔗 Documentation: {finding.documentation_link}")
                
                # Examples
                if finding.examples:
                    print(f"\n   📖 Examples:")
                    for example in finding.examples[:2]:  # Show first 2 examples
                        print(f"      • {example}")
                
                # Code snippet
                if finding.code_snippet:
                    print(f"\n   ⚠️  Problematic Code:")
                    for line in finding.code_snippet.split('\n'):
                        print(f"      {line}")
                
                # Fix code
                if finding.fix_code:
                    print(f"\n   ✨ Suggested Fix:")
                    for line in finding.fix_code.split('\n'):
                        print(f"      {line}")
                
                print(f"\n   " + "-"*96)
        
        else:
            print(f"\n✅ No issues found! Code looks good.")
        
        print(f"\n{'='*100}")
        print("END OF REVIEW")
        print("="*100 + "\n")
