from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.services.ollama_service import OllamaService
from app.services.review_service import ReviewService
from app.services.fix_service import FixService
from app.routes import review_routes

# Initialize FastAPI app
app = FastAPI(
    title="Automated Code Review API",
    description="AI-powered code review system using local LLM",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ollama_service = OllamaService(model_name="qwen2.5:0.5b")
review_service = ReviewService(ollama_service)
fix_service = FixService(ollama_service)

# Initialize routes
review_routes.init_services(ollama_service, review_service, fix_service)

# Include routers
app.include_router(review_routes.router, tags=["Code Review"])


@app.on_event("startup")
async def startup_event():
    """Check LLM availability on startup"""
    print("Starting up Code Review API...")
    model_available = await ollama_service.check_model_available()
    if not model_available:
        print(f"Warning: Model 'qwen2.5:0.5b' not found locally. Run: ollama pull qwen2.5:0.5b")
    else:
        print("✓ LLM model is ready")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Automated Code Review API",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
