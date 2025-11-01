"""
Quick test script to see comprehensive terminal output
Run this to see the formatted review output in your current terminal
"""
import asyncio
import sys
from app.services.ollama_service import OllamaService
from app.services.review_service import ReviewService

# Sample code with various issues
SAMPLE_CODE = '''def calculate_sum(list):  # Should not shadow built-in
    total = 0
    for i in range(len(list)):
        total += list[i]
    return total


def get_user_data(x):  # Unclear variable name
    data = {}
    data["id"] = x[0]
    data["name"] = x[1]
    data["email"] = x[2]
    if data["name"] == "":
        pass
    return data


class Calculator:
    # Missing docstring
    
    def divide(self, a, b):
        result = a / b  # No zero check
        return result
'''

async def main():
    """Run a code review and display comprehensive output"""
    print("\n🚀 Starting code review test...\n")
    
    # Initialize services
    ollama_service = OllamaService(model_name="qwen2.5-coder:7b-instruct")
    review_service = ReviewService(ollama_service)
    
    # Check if model is available
    model_available = await ollama_service.check_model_available()
    if not model_available:
        print("❌ Error: LLM model not available")
        print("Please run: ollama pull qwen2.5-coder:7b-instruct")
        sys.exit(1)
    
    print("✅ LLM model is ready\n")
    print("📝 Reviewing sample Python code...\n")
    
    # Perform review
    result = await review_service.review_code(
        code_content=SAMPLE_CODE,
        language="python",
        file_path="example.py"
    )
    
    print("\n✨ Review complete!")
    print(f"📊 API returned {result.total_issues} findings")
    
    if result.token_usage:
        print(f"🔢 Used {result.token_usage.get('total_tokens', 0)} tokens")

if __name__ == "__main__":
    asyncio.run(main())
