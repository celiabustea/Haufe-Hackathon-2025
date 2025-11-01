"""Service to generate and apply automatic code fixes"""
import json
from typing import List, Optional
from app.models.review import Finding
from app.services.ollama_service import OllamaService


class FixService:
    """Service to generate automatic fixes for code issues"""
    
    def __init__(self, ollama_service: OllamaService):
        self.ollama = ollama_service
    
    def get_fix_prompt(self, language: str, code_snippet: str, finding_description: str, suggestion: str) -> str:
        """Generate a prompt to ask LLM for a fix"""
        return f"""You are an expert {language} developer. Generate a corrected/improved version of this code snippet.

Problem: {finding_description}
Suggestion: {suggestion}

Original code:
```{language}
{code_snippet}
```

Provide ONLY the corrected code in a code block, no explanation."""
    
    async def generate_fix(self, language: str, code_snippet: str, finding: Finding) -> Optional[str]:
        """Generate a fix for a specific finding"""
        if not code_snippet:
            return None
        
        try:
            prompt = self.get_fix_prompt(
                language,
                code_snippet,
                finding.description,
                finding.suggestion
            )
            
            system_prompt = f"You are an expert {language} developer. Generate corrected code."
            
            response = await self.ollama.generate_review(system_prompt, prompt)
            
            # Extract code from markdown code block if present
            if "```" in response:
                parts = response.split("```")
                if len(parts) >= 2:
                    # Get content between backticks
                    code = parts[1].strip()
                    # Remove language identifier if present
                    if code.startswith(language):
                        code = code[len(language):].strip()
                    return code
            
            return response.strip()
        except Exception as e:
            print(f"Error generating fix: {e}")
            return None
    
    async def generate_fixes_for_findings(self, code_content: str, language: str, findings: List[Finding]) -> List[Finding]:
        """Generate fixes for all findings in a batch"""
        lines = code_content.split('\n')
        
        for finding in findings:
            if finding.line_number and 1 <= finding.line_number <= len(lines):
                # Extract code snippet around the error line
                start_line = max(0, finding.line_number - 2)
                end_line = min(len(lines), finding.line_number + 2)
                code_snippet = '\n'.join(lines[start_line:end_line])
                
                # Generate fix
                fix = await self.generate_fix(language, code_snippet, finding)
                finding.fix_code = fix
        
        return findings
