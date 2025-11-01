from pydantic import BaseModel
from typing import List, Optional
from enum import Enum


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Finding(BaseModel):
    """A single finding from code review"""
    line_number: Optional[int] = None
    severity: SeverityLevel
    category: str  # e.g., "style", "performance", "security", "architecture", "testing", "documentation"
    title: str
    description: str
    suggestion: str
    code_snippet: Optional[str] = None
    fix_code: Optional[str] = None  # Corrected/fixed code snippet
    documentation_link: Optional[str] = None  # Link to relevant documentation
    severity_reason: Optional[str] = None  # Why this severity level was assigned
    examples: Optional[List[str]] = None  # Example patterns of this issue
    best_practice: Optional[str] = None  # Best practice alternative
    effort_minutes: Optional[int] = None  # Estimated effort to fix in minutes
    dimensions: Optional[dict] = None  # Multi-dimensional scoring: security, performance, maintainability, etc.


class ReviewRequest(BaseModel):
    """Request to review code"""
    file_path: str
    code_content: str
    language: str
    guidelines: Optional[List[str]] = None


class ReviewResponse(BaseModel):
    """Code review results"""
    file_path: str
    language: str
    findings: List[Finding]
    summary: str
    total_issues: int
    token_usage: Optional[dict] = None


class BatchReviewRequest(BaseModel):
    """Request to review multiple files"""
    files: List[ReviewRequest]
    guidelines: Optional[List[str]] = None


class FixRequest(BaseModel):
    """Request to generate a fix for a specific code issue"""
    language: str
    code_snippet: str
    description: str
    suggestion: str
