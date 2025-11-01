from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List, Optional
from app.models.review import ReviewRequest, ReviewResponse, BatchReviewRequest, Finding, FixRequest
from app.services.review_service import ReviewService
from app.services.fix_service import FixService
from app.services.ollama_service import OllamaService

router = APIRouter()

# Global service instances (will be initialized in main)
ollama_service = None
review_service = None
fix_service = None


def init_services(ollama: OllamaService, review: ReviewService, fix: FixService = None):
    """Initialize services in routes"""
    global ollama_service, review_service, fix_service
    ollama_service = ollama
    review_service = review
    fix_service = fix or FixService(ollama)


@router.get("/health")
async def health_check():
    """Check if backend and LLM are working"""
    try:
        model_available = await ollama_service.check_model_available()
        return {
            "status": "ok",
            "ollama_connected": True,
            "model_available": model_available,
            "model": ollama_service.model_name
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "ollama_connected": False
        }


@router.post("/api/review", response_model=ReviewResponse)
async def review_code(request: ReviewRequest):
    """Review a single piece of code"""
    try:
        result = await review_service.review_code(
            code_content=request.code_content,
            language=request.language,
            file_path=request.file_path,
            custom_guidelines=request.guidelines
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/review/snippet", response_model=ReviewResponse)
async def review_snippet(request: ReviewRequest):
    """Review a code snippet (optimized for VS Code extension)"""
    # Same as /api/review but with explicit name for extension
    try:
        result = await review_service.review_code(
            code_content=request.code_content,
            language=request.language,
            file_path=request.file_path or "snippet",
            custom_guidelines=request.guidelines
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/fix/generate")
async def generate_fix(request: FixRequest):
    """Generate a fix for a specific code issue"""
    try:
        from app.models.review import SeverityLevel

        temp_finding = Finding(
            severity=SeverityLevel.MEDIUM,
            category="auto-fix",
            title="Auto-fix",
            description=request.description,
            suggestion=request.suggestion
        )

        fix_code = await fix_service.generate_fix(request.language, request.code_snippet, temp_finding)
        return {
            "success": True,
            "fix_code": fix_code,
            "original": request.code_snippet
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
        results = []
        for file_request in request.files:
            result = await review_service.review_code(
                code_content=file_request.code_content,
                language=file_request.language,
                file_path=file_request.file_path,
                custom_guidelines=request.guidelines or file_request.guidelines
            )
            results.append(result)
        
        return {
            "files_reviewed": len(results),
            "results": results,
            "total_issues": sum(r.total_issues for r in results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/languages")
async def get_supported_languages():
    """Get list of supported programming languages"""
    return {
        "languages": [
            {"name": "python", "extensions": [".py"], "alias": "Python"},
            {"name": "javascript", "extensions": [".js", ".jsx"], "alias": "JavaScript"},
            {"name": "typescript", "extensions": [".ts", ".tsx"], "alias": "TypeScript"},
            {"name": "java", "extensions": [".java"], "alias": "Java"},
            {"name": "csharp", "extensions": [".cs"], "alias": "C#"},
            {"name": "cpp", "extensions": [".cpp", ".cc", ".cxx", ".h"], "alias": "C++"},
            {"name": "go", "extensions": [".go"], "alias": "Go"},
            {"name": "rust", "extensions": [".rs"], "alias": "Rust"},
            {"name": "php", "extensions": [".php"], "alias": "PHP"},
            {"name": "ruby", "extensions": [".rb"], "alias": "Ruby"},
        ]
    }


@router.post("/api/guidelines/import")
async def import_custom_guidelines(guidelines: dict):
    """Import custom coding guidelines from JSON"""
    import json
    try:
        # Save to file for persistence
        with open("custom_guidelines.json", "w") as f:
            json.dump(guidelines, f, indent=2)
        return {"success": True, "message": "Guidelines imported successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/llm/pull-model")
async def pull_model(model_name: str = "mistral"):
    """Pull a model from Ollama registry"""
    try:
        ollama_service.model_name = model_name
        success = await ollama_service.pull_model()
        return {
            "success": success,
            "model": model_name,
            "message": f"Model {'pulled' if success else 'failed to pull'}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/fix/generate")
async def generate_fix(request: ReviewRequest):
    """Generate a fix for a specific code issue"""
    try:
        from app.models.review import Finding, SeverityLevel
        
        finding = Finding(
            severity=SeverityLevel.MEDIUM,
            category="auto-fix",
            title="Auto-fix",
            description=request.code_content,
            suggestion=request.code_content
        )
        
        fix_code = await fix_service.generate_fix(request.language, request.code_content, finding)
        return {
            "success": True,
            "fix_code": fix_code,
            "original": request.code_content
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

