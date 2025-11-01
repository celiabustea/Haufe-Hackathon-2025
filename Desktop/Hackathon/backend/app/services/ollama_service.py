import ollama
from typing import Optional
import asyncio
import json


class OllamaService:
    """Service to interact with local Ollama LLM"""
    
    def __init__(self, model_name: str = "mistral", base_url: str = "http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url
        self.client = ollama.Client(host=base_url)
    
    async def check_model_available(self) -> bool:
        """Check if model is available locally"""
        try:
           
            response = self.client.generate(
                model=self.model_name,
                prompt="test",
                stream=False
            )
            return True
        except Exception as e:
            print(f"Error checking model: {e}")
            return False
    
    async def pull_model(self) -> bool:
        """Pull model from Ollama registry"""
        try:
            print(f"Pulling {self.model_name}...")
            self.client.pull(self.model_name)
            print(f"Successfully pulled {self.model_name}")
            return True
        except Exception as e:
            print(f"Error pulling model: {e}")
            return False
    
    async def generate_review(self, prompt: str, system_prompt: Optional[str] = None) -> dict:
        """
        Generate code review using LLM
        Returns dict with response and token usage
        """
        try:
            response = self.client.generate(
                model=self.model_name,
                prompt=prompt,
                system=system_prompt or "",
                stream=False,
                options={
                    "num_predict": 4096,  # Allow longer responses
                    "temperature": 0.7,
                    "top_p": 0.9
                }
            )
            
            return {
                "response": response.get("response", ""),
                "eval_count": response.get("eval_count", 0),
                "prompt_eval_count": response.get("prompt_eval_count", 0),
                "total_tokens": response.get("eval_count", 0) + response.get("prompt_eval_count", 0)
            }
        except Exception as e:
            return {
                "response": f"Error generating review: {str(e)}",
                "error": True
            }
    
    async def generate_chat(self, messages: list, system_prompt: Optional[str] = None) -> dict:
        """
        Generate response using chat interface
        """
        try:
            response = self.client.chat(
                model=self.model_name,
                messages=messages,
                stream=False
            )
            
            return {
                "response": response.get("message", {}).get("content", ""),
                "eval_count": response.get("eval_count", 0),
                "prompt_eval_count": response.get("prompt_eval_count", 0),
                "total_tokens": response.get("eval_count", 0) + response.get("prompt_eval_count", 0)
            }
        except Exception as e:
            return {
                "response": f"Error generating response: {str(e)}",
                "error": True
            }
