export interface Finding {
  line_number: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  suggestion: string;
  code_snippet: string | null;
  fix_code?: string | null;
  documentation_link?: string | null;
  severity_reason?: string;
  examples?: string[];
  best_practice?: string;
  effort_minutes?: number;
  dimensions?: { [key: string]: number };
}

export interface ReviewResponse {
  file_path: string;
  language: string;
  findings: Finding[];
  summary: string;
  total_issues: number;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface HealthResponse {
  status: string;
  ollama_connected: boolean;
  model_available: boolean;
  model: string;
}

export interface LanguageInfo {
  name: string;
  extensions: string[];
  alias: string;
}

export interface FixResult {
  success: boolean;
  fix_code?: string;
  original?: string;
  error?: string;
}

export class ReviewClient {
  constructor(private baseUrl: string) {}

  async checkHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async reviewCode(
    code: string,
    language: string,
    filePath: string = 'snippet'
  ): Promise<ReviewResponse> {
    console.log('ReviewClient: Making request to backend with:', { filePath, language, codeLength: code.length });
    
    const response = await fetch(`${this.baseUrl}/api/review/snippet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: filePath,
        code_content: code,
        language: language,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ReviewClient: Backend error:', errorText);
      throw new Error(`Review failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('ReviewClient: Received response:', {
      findingsCount: data.findings?.length,
      totalIssues: data.total_issues,
      summary: data.summary?.substring(0, 50)
    });
    
    return data;
  }

  async getLanguages(): Promise<LanguageInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/languages`);
    if (!response.ok) {
      throw new Error(`Failed to fetch languages: ${response.statusText}`);
    }
    const data = await response.json();
    return data.languages;
  }

  async generateFix(
    language: string,
    codeSnippet: string,
    description: string,
    suggestion: string
  ): Promise<FixResult> {
    const response = await fetch(`${this.baseUrl}/api/fix/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        code_snippet: codeSnippet,
        description,
        suggestion,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Fix generation failed: ${response.statusText} - ${error}`,
      };
    }

    return response.json();
  }
}
