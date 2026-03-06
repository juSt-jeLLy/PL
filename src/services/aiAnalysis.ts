import { SecurityFinding, CodeSuggestion } from '../types/repo';
import { BACKEND_URL } from '../utils/repoUtils';

export async function analyzeChunkWithAI(chunk: any): Promise<SecurityFinding[]> {
  const prompt = `You are a senior code security and quality analyst. Analyze the following code from file "${chunk.filePath}" (chunk ${chunk.chunkIndex + 1}/${chunk.total}).

Look for security vulnerabilities, potential exploits, and security anti-patterns. Return a JSON array of findings:

[
  {
    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
    "type": "e.g. SQL Injection",
    "title": "Brief issue title",
    "description": "Detailed explanation",
    "file": "${chunk.filePath}",
    "line": 42
  }
]

CODE TO ANALYZE:
${chunk.content}`;

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3-groq-70b-8192-tool-use-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) throw new Error("AI analysis failed");
  const data = await response.json();
  const text = data.content?.map((b: any) => b.text || "").join("") || "[]";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

export async function suggestImprovementsWithAI(chunk: any): Promise<CodeSuggestion[]> {
  const prompt = `You are a senior software engineer. Analyze this code from "${chunk.filePath}" and suggest improvements.

Focus on:
- Code quality & readability
- Performance optimizations
- Best practices
- Architecture improvements
- Testing opportunities

Return JSON array of suggestions:

[
  {
    "priority": "HIGH|MEDIUM|LOW",
    "category": "Architecture|Readability|Testing|Edge Case|Better Approach",
    "title": "Brief suggestion title",
    "description": "Detailed explanation",
    "file": "${chunk.filePath}",
    "line": 42,
    "example": "Optional code example"
  }
]

CODE TO ANALYZE:
${chunk.content}`;

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3-groq-70b-8192-tool-use-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) throw new Error("AI suggestion failed");
  const data = await response.json();
  const text = data.content?.map((b: any) => b.text || "").join("") || "[]";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}
