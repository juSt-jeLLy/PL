import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, Shield, AlertTriangle, ChevronDown, ChevronRight, Bug, Lock, Zap, Eye, Code, TestTube, Layers, BookOpen, AlertCircle, CheckCircle } from "lucide-react";

type RepoSnapshot = {
  repo: {
    id: number;
    name: string;
    fullName: string;
    private: boolean;
    description: string | null;
    defaultBranch: string;
    language: string | null;
    stars: number;
    forks: number;
    openIssuesCount: number;
    htmlUrl: string;
    pushedAt: string;
    createdAt: string;
    updatedAt: string;
  };
  issues: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    comments: number;
    user: string;
    createdAt: string;
    updatedAt: string;
    url: string;
  }>;
  pullRequests: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    user: string;
    draft: boolean;
    createdAt: string;
    updatedAt: string;
    mergedAt: string | null;
    url: string;
  }>;
  rootFiles: Array<{
    name: string;
    path: string;
    type: string;
    size: number;
    url: string;
  }>;
  fileTree: Array<{
    path: string;
    type: string;
    size: number;
    sha: string;
    url: string;
  }>;
  summary: {
    issueCount: number;
    pullRequestCount: number;
    rootFileCount: number;
    treeEntryCount: number;
    treeTruncated: boolean;
    installationId: number;
    tokenExpiresAt: string;
  };
  fetchedAt: string;
};

type FetchFailurePayload = {
  error?: string;
  installUrl?: string | null;
  appSlug?: string | null;
  notInstalled?: boolean;
};

// ── AI Analysis Types & Helpers ──────────────────────────────────────────────
type SecurityFinding = {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  type: string;
  file: string;
  line: string | null;
  description: string;
  suggestion: string;
};

type CodeSuggestion = {
  category: "Architecture" | "Readability" | "Edge Case" | "Better Approach" | "Testing";
  priority: "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line: string | null;
  title: string;
  description: string;
  example?: string;
};

// Analysis configuration
const BACKEND_URL = "http://localhost:3005";
const ALLOWED_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".cpp", ".c", ".cs", ".rb", ".php", ".yaml", ".yml", ".json", ".sh"];
const IGNORED_PATHS = ["node_modules/", ".git/", "dist/", "build/", "vendor/", "__pycache__/", ".next/", "coverage/"];

function shouldIncludeFile(path: string, size?: number) {
  if (IGNORED_PATHS.some(p => path.includes(p))) return false;
  if (size && size > 300000) return false;
  return ALLOWED_EXTENSIONS.some(ext => path.endsWith(ext));
}

function chunkCode(content: string, filePath: string, chunkSize = 250) {
  const lines = content.split("\n");
  if (lines.length <= chunkSize) return [{ filePath, content, chunkIndex: 0, total: 1 }];
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize - 20) {
    chunks.push({
      filePath,
      content: lines.slice(i, i + chunkSize).join("\n"),
      chunkIndex: chunks.length,
      total: Math.ceil(lines.length / (chunkSize - 20)),
    });
    if (i + chunkSize >= lines.length) break;
  }
  return chunks;
}

async function fetchFileContent(owner: string, repo: string, path: string) {
  const res = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === "base64") return atob(data.content.replace(/\n/g, ""));
  return null;
}

async function analyzeChunkWithAI(chunk: any): Promise<SecurityFinding[]> {
  const prompt = `You are a senior code security and quality analyst. Analyze the following code from file "${chunk.filePath}" (chunk ${chunk.chunkIndex + 1}/${chunk.total}).

Look for:
1. Security vulnerabilities (SQL injection, XSS, hardcoded secrets, insecure APIs, etc.)
2. Bugs and logical errors
3. Code quality issues (dead code, bad practices, code smells)
4. Performance problems

Return ONLY a valid JSON array (no markdown, no explanation) with this structure:
[
  {
    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
    "type": "e.g. SQL Injection",
    "file": "${chunk.filePath}",
    "line": "approximate line number or range, or null",
    "description": "clear description of the issue",
    "suggestion": "how to fix it"
  }
]

If no issues found, return an empty array: []

CODE TO ANALYZE:
\`\`\`
${chunk.content.slice(0, 6000)}
\`\`\``;

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-1.5-flash",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.map((b: any) => b.text || "").join("") || "[]";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

async function suggestImprovementsWithAI(chunk: any): Promise<CodeSuggestion[]> {
  const prompt = `You are a senior software engineer. Analyze this code from "${chunk.filePath}" and suggest improvements.

Focus on:
1. Better architecture / design patterns
2. Code readability and maintainability  
3. Missing features or edge cases not handled
4. Better libraries or approaches that could be used
5. Test coverage suggestions

Return ONLY a valid JSON array:
[
  {
    "category": "Architecture|Readability|Edge Case|Better Approach|Testing",
    "priority": "HIGH|MEDIUM|LOW",
    "file": "${chunk.filePath}",
    "line": "line number or null",
    "title": "short title of suggestion",
    "description": "detailed explanation",
    "example": "optional code snippet showing the improvement"
  }
]

If no suggestions, return: []

CODE:
\`\`\`
${chunk.content.slice(0, 6000)}
\`\`\``;

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-1.5-flash",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.map((b: any) => b.text || "").join("") || "[]";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { 
    return []; 
  }
}

const INSTALL_PENDING_REPO_KEY = "mergex:pending-github-repo";

const formatDate = (isoDate?: string) => {
  if (!isoDate) {
    return "—";
  }
  return new Date(isoDate).toLocaleString();
};

const decodeStateRepo = (encodedState: string | null) => {
  if (!encodedState) {
    return null;
  }

  try {
    const decoded = atob(encodedState);
    const parsed = JSON.parse(decoded);
    if (typeof parsed?.repoUrl === "string" && parsed.repoUrl.trim()) {
      return parsed.repoUrl.trim();
    }
    return null;
  } catch {
    return null;
  }
};

export default function AddRepo() {
  return <AddRepoContent />;
}

export function AddRepoContent({ embedded = false }: { embedded?: boolean }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RepoSnapshot | null>(null);
  
  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<Array<{msg: string, type: string, ts: number}>>([]);
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([]);
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);
  const [analysisStats, setAnalysisStats] = useState<{filesAnalyzed: number, chunksAnalyzed: number, issuesFound: number, suggestionsGenerated: number} | null>(null);
  
  // UI state
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [findingFilter, setFindingFilter] = useState<string>("ALL");
  const [suggestionFilter, setSuggestionFilter] = useState<string>("ALL");

  const canFetch = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);

  const addAnalysisLog = (msg: string, type = "info") =>
    setAnalysisLogs(prev => [...prev, { msg, type, ts: Date.now() }]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <AlertCircle className="h-4 w-4" />;
      case "HIGH": return <AlertTriangle className="h-4 w-4" />;
      case "MEDIUM": return <Eye className="h-4 w-4" />;
      case "LOW": return <Bug className="h-4 w-4" />;
      case "INFO": return <CheckCircle className="h-4 w-4" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Architecture": return <Layers className="h-4 w-4" />;
      case "Readability": return <BookOpen className="h-4 w-4" />;
      case "Testing": return <TestTube className="h-4 w-4" />;
      case "Edge Case": return <AlertTriangle className="h-4 w-4" />;
      case "Better Approach": return <Zap className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "border-red-500 bg-red-500/10 text-red-400";
      case "HIGH": return "border-orange-500 bg-orange-500/10 text-orange-400";
      case "MEDIUM": return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
      case "LOW": return "border-green-500 bg-green-500/10 text-green-400";
      case "INFO": return "border-blue-500 bg-blue-500/10 text-blue-400";
      default: return "border-gray-500 bg-gray-500/10 text-gray-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH": return "border-orange-500 bg-orange-500/10 text-orange-400";
      case "MEDIUM": return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
      case "LOW": return "border-green-500 bg-green-500/10 text-green-400";
      default: return "border-gray-500 bg-gray-500/10 text-gray-400";
    }
  };

  const filteredFindings = findingFilter === "ALL" 
    ? securityFindings 
    : securityFindings.filter(f => f.severity === findingFilter);

  const filteredSuggestions = suggestionFilter === "ALL" 
    ? codeSuggestions 
    : codeSuggestions.filter(s => s.category === suggestionFilter);

  const parseRepoURL = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  };

  const runSecurityAnalysis = async () => {
    if (!result) return;
    
    const parsed = parseRepoURL(result.repo.htmlUrl);
    if (!parsed) {
      setError("Cannot parse repository URL for analysis");
      return;
    }

    setAnalyzing(true);
    setAnalysisLogs([]);
    setSecurityFindings([]);
    setCodeSuggestions([]);
    setAnalysisComplete(false);
    
    const { owner, repo } = parsed;

    try {
      addAnalysisLog(`🔍 Starting security analysis for ${owner}/${repo}...`);
      
      // Filter code files from the existing file tree
      const codeFiles = result.fileTree.filter(f => 
        f.type === "blob" && shouldIncludeFile(f.path, f.size)
      );
      
      const maxFiles = Math.min(codeFiles.length, 5); // Limit to 5 files for demo
      addAnalysisLog(`📂 Analyzing ${maxFiles} of ${codeFiles.length} code files...`);

      const allChunks = [];
      for (let i = 0; i < maxFiles; i++) {
        const file = codeFiles[i];
        addAnalysisLog(`📄 Fetching (${i + 1}/${maxFiles}): ${file.path}`);
        const content = await fetchFileContent(owner, repo, file.path);
        if (content) {
          allChunks.push(...chunkCode(content, file.path));
        }
        // Add delay to respect rate limits
        if (i < maxFiles - 1) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      addAnalysisLog(`📦 Total chunks to analyze: ${allChunks.length}`, "success");

      // Security analysis
      const allFindings: SecurityFinding[] = [];
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        addAnalysisLog(`🔒 Analyzing security in chunk ${i + 1}/${allChunks.length}: ${chunk.filePath}...`);
        const results = await analyzeChunkWithAI(chunk);
        allFindings.push(...results);
        if (results.length > 0) {
          addAnalysisLog(`⚠️ Found ${results.length} security issue(s) in ${chunk.filePath}`, "warn");
        }
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Code improvement suggestions
      const allSuggestions: CodeSuggestion[] = [];
      addAnalysisLog(`💡 Generating improvement suggestions...`);
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        addAnalysisLog(`💡 Analyzing improvements for chunk ${i + 1}/${allChunks.length}: ${chunk.filePath}...`);
        const suggestions = await suggestImprovementsWithAI(chunk);
        allSuggestions.push(...suggestions);
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setSecurityFindings(allFindings);
      setCodeSuggestions(allSuggestions);
      setAnalysisStats({
        filesAnalyzed: maxFiles,
        chunksAnalyzed: allChunks.length,
        issuesFound: allFindings.length,
        suggestionsGenerated: allSuggestions.length
      });
      
      addAnalysisLog(`✅ Analysis complete! Found ${allFindings.length} security issues and ${allSuggestions.length} improvement suggestions`, "success");
      setAnalysisComplete(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Analysis failed";
      addAnalysisLog(`❌ ${errorMsg}`, "error");
      setError(errorMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const redirectToInstall = useCallback((baseInstallUrl: string, repo: string) => {
    const trimmedRepo = repo.trim();
    if (!trimmedRepo) {
      return;
    }

    try {
      window.sessionStorage.setItem(INSTALL_PENDING_REPO_KEY, trimmedRepo);
    } catch {
      // Ignore storage errors in private browsing modes.
    }

    let nextInstallUrl = baseInstallUrl;
    try {
      const installTarget = new URL(baseInstallUrl);
      const state = btoa(
        JSON.stringify({
          repoUrl: trimmedRepo,
          ts: Date.now(),
        })
      );
      installTarget.searchParams.set("state", state);
      nextInstallUrl = installTarget.toString();
    } catch {
      // Fallback to original URL if URL parsing fails.
    }

    window.location.href = nextInstallUrl;
  }, []);

  const fetchRepoSnapshot = useCallback(async (rawRepo: string) => {
    const trimmedRepo = rawRepo.trim();
    if (!trimmedRepo) {
      setError("Enter a GitHub repo URL or owner/repo first.");
      return false;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/github/repo-snapshot?repoUrl=${encodeURIComponent(trimmedRepo)}`
      );
      const payload = (await response.json()) as RepoSnapshot | FetchFailurePayload;

      if (!response.ok) {
        setResult(null);
        const fallbackInstallUrl =
          payload?.installUrl ||
          (payload?.appSlug
            ? `https://github.com/apps/${payload.appSlug}/installations/new`
            : null);

        if (payload?.notInstalled && fallbackInstallUrl) {
          setStatusMessage("GitHub App not installed. Redirecting to install page...");
          redirectToInstall(fallbackInstallUrl, trimmedRepo);
          return false;
        }

        setError(payload?.error || "GitHub fetch failed.");
        return false;
      }

      setResult(payload as RepoSnapshot);
      return true;
    } catch (fetchError: unknown) {
      setResult(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Something went wrong while fetching the repository."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [redirectToInstall]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canFetch) {
      setError("Enter a GitHub repo URL or owner/repo first.");
      return;
    }

    await fetchRepoSnapshot(repoUrl);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupAction = params.get("setup_action");
    const installationId = params.get("installation_id");
    const stateRepo = decodeStateRepo(params.get("state"));

    if (!setupAction && !installationId) {
      return;
    }

    const storedRepo = (() => {
      try {
        return window.sessionStorage.getItem(INSTALL_PENDING_REPO_KEY);
      } catch {
        return null;
      }
    })();

    const repoFromCallback = stateRepo || storedRepo;

    if (setupAction === "request") {
      setStatusMessage(
        "Install request submitted. Ask the org owner to approve it, then retry fetch."
      );
    } else if (repoFromCallback) {
      setRepoUrl(repoFromCallback);
      setStatusMessage("Installation detected. Fetching repository data...");
      void fetchRepoSnapshot(repoFromCallback);
    }

    try {
      window.sessionStorage.removeItem(INSTALL_PENDING_REPO_KEY);
    } catch {
      // Ignore cleanup errors.
    }

    params.delete("setup_action");
    params.delete("installation_id");
    params.delete("state");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [fetchRepoSnapshot]);

  return (
    <div className={embedded ? "" : "min-h-screen bg-background px-4 py-8 md:px-8"}>
      <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
        {!embedded && (
          <div className="flex items-center justify-between border-b-2 border-border pb-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase text-muted-foreground transition-colors hover:text-neon-green"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="font-display text-2xl font-extrabold uppercase">
              GitHub Repo Fetch Test
            </h1>
            <div className="w-16" />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border-2 border-border bg-card p-4 md:p-6"
        >
          <label
            htmlFor="repo-url"
            className="block font-mono text-xs font-bold uppercase text-muted-foreground"
          >
            GitHub URL or owner/repo
          </label>
          <input
            id="repo-url"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder="https://github.com/octocat/Hello-World"
            className="w-full border-2 border-border bg-background px-3 py-2 font-mono text-sm focus:border-neon-green focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="brutal-btn inline-flex items-center gap-2 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching
                </>
              ) : (
                "Fetch Repo Data"
              )}
            </button>
            <p className="font-mono text-xs text-muted-foreground">
              Requires this GitHub App to be installed on the target repository.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Set GitHub App Setup URL to: {window.location.origin}/add-repo
          </p>
        </form>

        {statusMessage && (
          <div className="border-2 border-neon-cyan bg-neon-cyan/10 px-4 py-3 font-mono text-sm text-neon-cyan">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="border-2 border-neon-red bg-neon-red/10 px-4 py-3 font-mono text-sm text-neon-red">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-5">
            <section className="border-2 border-border bg-card p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-extrabold uppercase">
                    {result.repo.fullName}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {result.repo.description || "No description provided."}
                  </p>
                </div>
                <a
                  href={result.repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 border-2 border-border bg-background px-3 py-1 font-mono text-xs font-bold uppercase hover:border-neon-cyan hover:text-neon-cyan"
                >
                  Open on GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Default Branch</div>
                  <div className="mt-1 font-bold">{result.repo.defaultBranch}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Language</div>
                  <div className="mt-1 font-bold">{result.repo.language || "n/a"}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Stars</div>
                  <div className="mt-1 font-bold">{result.repo.stars}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Forks</div>
                  <div className="mt-1 font-bold">{result.repo.forks}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Fetched At</div>
                  <div className="mt-1 font-bold">{formatDate(result.fetchedAt)}</div>
                </div>
              </div>
            </section>

            {/* AI Code Analysis Section */}
            <section className="border-2 border-border bg-card p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-extrabold uppercase">
                    🤖 AI Security Analysis
                  </h3>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    Run AI-powered code analysis to detect security issues and get improvement suggestions
                  </p>
                </div>
                <button
                  onClick={runSecurityAnalysis}
                  disabled={analyzing}
                  className="brutal-btn inline-flex items-center gap-2 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Analyze Code
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Stats */}
              {analysisStats && (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                    <div className="text-muted-foreground">Files Analyzed</div>
                    <div className="mt-1 font-bold text-neon-cyan">{analysisStats.filesAnalyzed}</div>
                  </div>
                  <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                    <div className="text-muted-foreground">Security Issues</div>
                    <div className="mt-1 font-bold text-neon-red">{analysisStats.issuesFound}</div>
                  </div>
                  <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                    <div className="text-muted-foreground">Suggestions</div>
                    <div className="mt-1 font-bold text-neon-amber">{analysisStats.suggestionsGenerated}</div>
                  </div>
                  <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                    <div className="text-muted-foreground">Code Chunks</div>
                    <div className="mt-1 font-bold">{analysisStats.chunksAnalyzed}</div>
                  </div>
                </div>
              )}

              {/* Analysis Log */}
              {analysisLogs.length > 0 && (
                <div className="mt-4 border-2 border-border bg-background p-4">
                  <h4 className="mb-2 font-mono text-xs font-bold uppercase text-muted-foreground">Analysis Log</h4>
                  <div className="max-h-32 space-y-1 overflow-auto">
                    {analysisLogs.map((log, i) => (
                      <div key={i} className={`font-mono text-xs ${
                        log.type === "error" ? "text-neon-red" : 
                        log.type === "warn" ? "text-neon-amber" : 
                        log.type === "success" ? "text-neon-green" : 
                        "text-muted-foreground"
                      }`}>
                        <span className="opacity-50 mr-2">{new Date(log.ts).toLocaleTimeString()}</span>
                        {log.msg}
                      </div>
                    ))}
                    {analyzing && <div className="font-mono text-xs text-neon-green">⏳ Working...</div>}
                  </div>
                </div>
              )}
            </section>

            {/* Analysis Results */}
            {analysisComplete && (
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Security Findings */}
                <section className="border-2 border-border bg-card p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-extrabold uppercase flex items-center gap-2">
                      <Lock className="h-5 w-5 text-neon-red" />
                      Security Issues ({filteredFindings.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <select 
                        value={findingFilter} 
                        onChange={(e) => setFindingFilter(e.target.value)}
                        className="border-2 border-border bg-background px-2 py-1 font-mono text-xs"
                      >
                        <option value="ALL">All Severities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                        <option value="INFO">Info</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-auto">
                    {filteredFindings.length === 0 && findingFilter === "ALL" && (
                      <div className="border-2 border-green-500 bg-green-500/10 p-6 text-center rounded-lg">
                        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                        <div className="font-mono text-lg font-bold text-green-400">🎉 No Security Issues Found!</div>
                        <div className="mt-2 font-mono text-sm text-muted-foreground">Your code appears to be secure</div>
                      </div>
                    )}
                    
                    {filteredFindings.length === 0 && findingFilter !== "ALL" && (
                      <div className="border-2 border-border bg-background p-4 text-center rounded-lg">
                        <div className="font-mono text-sm text-muted-foreground">No {findingFilter.toLowerCase()} severity issues found</div>
                      </div>
                    )}
                    
                    {filteredFindings.map((finding, i) => {
                      const isExpanded = expandedFinding === i;
                      return (
                        <div key={i} className={`brutal-card ${getSeverityColor(finding.severity)} transition-all duration-200 hover:shadow-lg cursor-pointer`}>
                          <div 
                            onClick={() => setExpandedFinding(isExpanded ? null : i)}
                            className="p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="flex items-center gap-2">
                                  {getSeverityIcon(finding.severity)}
                                  <span className="font-mono text-xs font-bold px-2 py-1 bg-current/20 rounded">
                                    {finding.severity}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-mono text-sm font-bold mb-1">{finding.type}</h4>
                                  <div className="font-mono text-xs opacity-70 flex items-center gap-2">
                                    <Code className="h-3 w-3" />
                                    {finding.file}{finding.line ? `:${finding.line}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="ml-2">
                                {isExpanded ? 
                                  <ChevronDown className="h-4 w-4" /> : 
                                  <ChevronRight className="h-4 w-4" />
                                }
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                                <div className="border-t border-current/20 pt-3">
                                  <h5 className="font-mono text-xs font-bold mb-2 opacity-70">DESCRIPTION</h5>
                                  <p className="font-mono text-xs leading-relaxed">{finding.description}</p>
                                </div>
                                
                                <div className="border-t border-current/20 pt-3">
                                  <h5 className="font-mono text-xs font-bold mb-2 opacity-70 flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    RECOMMENDED FIX
                                  </h5>
                                  <div className="bg-background/50 border border-current/30 rounded p-3">
                                    <p className="font-mono text-xs">{finding.suggestion}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 pt-2">
                                  <button className="font-mono text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded hover:bg-green-500/30 transition-colors">
                                    Mark as Fixed
                                  </button>
                                  <button className="font-mono text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30 px-3 py-1 rounded hover:bg-gray-500/30 transition-colors">
                                    Ignore
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Code Suggestions */}
                <section className="border-2 border-border bg-card p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-extrabold uppercase flex items-center gap-2">
                      <Zap className="h-5 w-5 text-neon-cyan" />
                      Improvements ({filteredSuggestions.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <select 
                        value={suggestionFilter} 
                        onChange={(e) => setSuggestionFilter(e.target.value)}
                        className="border-2 border-border bg-background px-2 py-1 font-mono text-xs"
                      >
                        <option value="ALL">All Categories</option>
                        <option value="Architecture">Architecture</option>
                        <option value="Readability">Readability</option>
                        <option value="Testing">Testing</option>
                        <option value="Edge Case">Edge Cases</option>
                        <option value="Better Approach">Better Approach</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-auto">
                    {filteredSuggestions.length === 0 && suggestionFilter === "ALL" && (
                      <div className="border-2 border-blue-500 bg-blue-500/10 p-6 text-center rounded-lg">
                        <CheckCircle className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                        <div className="font-mono text-lg font-bold text-blue-400">✨ Code Looks Great!</div>
                        <div className="mt-2 font-mono text-sm text-muted-foreground">No improvement suggestions at this time</div>
                      </div>
                    )}
                    
                    {filteredSuggestions.length === 0 && suggestionFilter !== "ALL" && (
                      <div className="border-2 border-border bg-background p-4 text-center rounded-lg">
                        <div className="font-mono text-sm text-muted-foreground">No {suggestionFilter.toLowerCase()} suggestions found</div>
                      </div>
                    )}
                    
                    {filteredSuggestions.map((suggestion, i) => {
                      const isExpanded = expandedSuggestion === i;
                      return (
                        <div key={i} className={`brutal-card ${getPriorityColor(suggestion.priority)} transition-all duration-200 hover:shadow-lg cursor-pointer`}>
                          <div 
                            onClick={() => setExpandedSuggestion(isExpanded ? null : i)}
                            className="p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="flex items-center gap-2">
                                  {getCategoryIcon(suggestion.category)}
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold px-2 py-1 bg-current/20 rounded">
                                      {suggestion.priority}
                                    </span>
                                    <span className="font-mono text-xs bg-neon-cyan/20 text-neon-cyan px-2 py-1 rounded">
                                      {suggestion.category}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-mono text-sm font-bold mb-1">{suggestion.title}</h4>
                                  <div className="font-mono text-xs opacity-70 flex items-center gap-2">
                                    <Code className="h-3 w-3" />
                                    {suggestion.file}{suggestion.line ? `:${suggestion.line}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="ml-2">
                                {isExpanded ? 
                                  <ChevronDown className="h-4 w-4" /> : 
                                  <ChevronRight className="h-4 w-4" />
                                }
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                                <div className="border-t border-current/20 pt-3">
                                  <h5 className="font-mono text-xs font-bold mb-2 opacity-70">DESCRIPTION</h5>
                                  <p className="font-mono text-xs leading-relaxed">{suggestion.description}</p>
                                </div>
                                
                                {suggestion.example && (
                                  <div className="border-t border-current/20 pt-3">
                                    <h5 className="font-mono text-xs font-bold mb-2 opacity-70 flex items-center gap-1">
                                      <Code className="h-3 w-3" />
                                      CODE EXAMPLE
                                    </h5>
                                    <div className="bg-background border border-current/30 rounded overflow-hidden">
                                      <div className="bg-current/10 px-3 py-1 border-b border-current/20">
                                        <span className="font-mono text-xs opacity-70">Suggested Implementation</span>
                                      </div>
                                      <pre className="p-3 font-mono text-xs overflow-auto bg-background/50">
                                        <code>{suggestion.example}</code>
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2 pt-2">
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="font-mono opacity-70">Impact:</span>
                                    <div className="flex">
                                      {[1,2,3,4,5].map(star => (
                                        <div key={star} className={`w-3 h-3 ${star <= (suggestion.priority === "HIGH" ? 5 : suggestion.priority === "MEDIUM" ? 3 : 1) ? "bg-current" : "bg-current/20"} mr-1 rounded-sm`} />
                                      ))}
                                    </div>
                                  </div>
                                  <button className="font-mono text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded hover:bg-blue-500/30 transition-colors ml-auto">
                                    Apply Suggestion
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="border-2 border-border bg-card p-4 md:p-6">
                <h3 className="mb-3 font-display text-lg font-extrabold uppercase">
                  Issues ({result.summary.issueCount})
                </h3>
                <div className="max-h-96 space-y-2 overflow-auto">
                  {result.issues.length === 0 && (
                    <p className="font-mono text-xs text-muted-foreground">No issues found.</p>
                  )}
                  {result.issues.map((issue) => (
                    <a
                      key={issue.id}
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-2 border-border bg-background p-3 hover:border-neon-cyan"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        #{issue.number} by {issue.user}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold">{issue.title}</div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        State: {issue.state} | Updated: {formatDate(issue.updatedAt)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="border-2 border-border bg-card p-4 md:p-6">
                <h3 className="mb-3 font-display text-lg font-extrabold uppercase">
                  Pull Requests ({result.summary.pullRequestCount})
                </h3>
                <div className="max-h-96 space-y-2 overflow-auto">
                  {result.pullRequests.length === 0 && (
                    <p className="font-mono text-xs text-muted-foreground">
                      No pull requests found.
                    </p>
                  )}
                  {result.pullRequests.map((pr) => (
                    <a
                      key={pr.id}
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-2 border-border bg-background p-3 hover:border-neon-green"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        #{pr.number} by {pr.user}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold">{pr.title}</div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        State: {pr.state}
                        {pr.draft ? " (draft)" : ""} | Updated: {formatDate(pr.updatedAt)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>

            <section className="border-2 border-border bg-card p-4 md:p-6">
              <h3 className="mb-3 font-display text-lg font-extrabold uppercase">
                Root Files ({result.summary.rootFileCount})
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.rootFiles.length === 0 && (
                  <p className="font-mono text-xs text-muted-foreground">No root files found.</p>
                )}
                {result.rootFiles.map((file) => (
                  <a
                    key={`${file.path}-${file.type}`}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border-2 border-border bg-background p-3 font-mono text-xs hover:border-neon-amber"
                  >
                    <div className="font-bold">{file.name}</div>
                    <div className="mt-1 text-muted-foreground">
                      {file.type} · {file.path}
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="border-2 border-border bg-card p-4 md:p-6">
              <h3 className="mb-2 font-display text-lg font-extrabold uppercase">
                Full File Tree Snapshot
              </h3>
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                {result.summary.treeEntryCount} entries
                {result.summary.treeTruncated ? " (truncated for safety)" : ""}
              </p>
              <div className="max-h-72 space-y-2 overflow-auto">
                {result.fileTree.slice(0, 120).map((entry) => (
                  <a
                    key={`${entry.sha}-${entry.path}`}
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block border-2 border-border bg-background p-2 font-mono text-xs hover:border-neon-cyan"
                  >
                    {entry.type} · {entry.path}
                  </a>
                ))}
                {result.fileTree.length === 0 && (
                  <p className="font-mono text-xs text-muted-foreground">
                    No tree entries available.
                  </p>
                )}
              </div>
            </section>

            <details className="border-2 border-border bg-card p-4">
              <summary className="cursor-pointer font-mono text-xs font-bold uppercase">
                Raw Payload (debug)
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto bg-background p-3 font-mono text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
