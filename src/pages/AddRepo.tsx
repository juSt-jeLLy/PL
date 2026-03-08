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
const BACKEND_URL =
  import.meta.env.VITE_REPOSCAN_URL?.replace(/\/$/, "") || "/reposcan";
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

const parseRepoURL = (url: string) => {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
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
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(new Set());
  const [isCreatingIssues, setIsCreatingIssues] = useState(false);
  const [createdIssues, setCreatedIssues] = useState<Array<{number?: number; url?: string; title?: string; error?: string; type?: string}>>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [isCreatingSuggestionIssues, setIsCreatingSuggestionIssues] = useState(false);
  const [createdSuggestionIssues, setCreatedSuggestionIssues] = useState<Array<{number?: number; url?: string; title?: string; error?: string; type?: string}>>([]);

  const canFetch = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);

  const addAnalysisLog = useCallback((msg: string, type = "info") => {
    setAnalysisLogs(prev => [...prev, { msg, type, ts: Date.now() }]);
  }, []);

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

  const toggleFinding = (i: number) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const postIssues = async (items: Array<{severity: string; type: string; file: string; line?: number | string | null; description: string; suggestion: string}>) => {
    const res = await fetch("/api/github/create-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: result!.repo.fullName, findings: items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create issues");
    return data.created || [];
  };

  const createGitHubIssues = async () => {
    if (selectedFindings.size === 0 || !result) return;
    setIsCreatingIssues(true);
    try {
      const toCreate = [...selectedFindings].map(i => securityFindings[i]);
      setCreatedIssues(await postIssues(toCreate));
      setSelectedFindings(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issues");
    } finally {
      setIsCreatingIssues(false);
    }
  };

  const toggleSuggestion = (i: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const createSuggestionIssues = async () => {
    if (selectedSuggestions.size === 0 || !result) return;
    setIsCreatingSuggestionIssues(true);
    try {
      const toCreate = [...selectedSuggestions].map(i => {
        const s = codeSuggestions[i];
        return {
          severity: s.priority,
          type: `[${s.category}] ${s.title}`,
          file: s.file,
          line: s.line,
          description: s.description,
          suggestion: s.example || "See description for implementation details.",
        };
      });
      setCreatedSuggestionIssues(await postIssues(toCreate));
      setSelectedSuggestions(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suggestion issues");
    } finally {
      setIsCreatingSuggestionIssues(false);
    }
  };

  const filteredSuggestions = suggestionFilter === "ALL" 
    ? codeSuggestions 
    : codeSuggestions.filter(s => s.category === suggestionFilter);

  const runSecurityAnalysis = useCallback(async (snapshot: RepoSnapshot) => {
    const parsed = parseRepoURL(snapshot.repo.htmlUrl);
    if (!parsed) {
      setError("Cannot parse repository URL for analysis");
      return false;
    }

    setAnalyzing(true);
    setAnalysisLogs([]);
    setSecurityFindings([]);
    setCodeSuggestions([]);
    setExpandedFinding(null);
    setExpandedSuggestion(null);
    setAnalysisComplete(false);
    setSelectedFindings(new Set());
    setCreatedIssues([]);
    setSelectedSuggestions(new Set());
    setCreatedSuggestionIssues([]);
    
    const { owner, repo } = parsed;

    try {
      addAnalysisLog(`🔍 Starting security analysis for ${owner}/${repo}...`);
      
      // Filter code files from the existing file tree
      const codeFiles = snapshot.fileTree.filter(f => 
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
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Analysis failed";
      addAnalysisLog(`❌ ${errorMsg}`, "error");
      setError(errorMsg);
      return false;
    } finally {
      setAnalyzing(false);
    }
  }, [addAnalysisLog]);

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
      const rawPayload: unknown = await response.json();

      if (!response.ok) {
        const failurePayload = (rawPayload ?? {}) as FetchFailurePayload;
        setResult(null);
        const fallbackInstallUrl =
          failurePayload.installUrl ||
          (failurePayload.appSlug
            ? `https://github.com/apps/${failurePayload.appSlug}/installations/new`
            : null);

        if (failurePayload.notInstalled && fallbackInstallUrl) {
          setStatusMessage("GitHub App not installed. Redirecting to install page...");
          redirectToInstall(fallbackInstallUrl, trimmedRepo);
          return false;
        }

        setError(failurePayload.error || "GitHub fetch failed.");
        return false;
      }

      const successPayload = rawPayload as RepoSnapshot;
      setResult(successPayload);
      setStatusMessage("Repository fetched. Running analysis...");
      const analysisComplete = await runSecurityAnalysis(successPayload);
      setStatusMessage(
        analysisComplete
          ? "Fetch + analysis complete."
          : "Repository fetched, but analysis failed. Check the error and logs."
      );
      return analysisComplete;
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
  }, [redirectToInstall, runSecurityAnalysis]);

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

            {/* ── 1. REPO HEADER ─────────────────────────────────────────── */}
            <section className="border-2 border-neon-green bg-card p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-neon-green/20 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-neon-green" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold uppercase text-neon-green">{result.repo.fullName}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{result.repo.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-3 font-mono text-xs text-muted-foreground">
                    <span>⭐ {result.repo.stars}</span>
                    <span>🍴 {result.repo.forks}</span>
                    <span>🔤 {result.repo.language || "n/a"}</span>
                    <span>🌿 {result.repo.defaultBranch}</span>
                  </div>
                  <a href={result.repo.htmlUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 border-2 border-border bg-background px-3 py-1 font-mono text-xs font-bold uppercase hover:border-neon-cyan hover:text-neon-cyan">
                    GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => result && void runSecurityAnalysis(result)}
                    disabled={analyzing || loading}
                    className="brutal-btn inline-flex items-center gap-2 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
                  >
                    {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Shield className="h-4 w-4" />Run Analysis</>}
                  </button>
                </div>
              </div>
            </section>

            {/* ── 2. ANALYSIS LOG + STATS ────────────────────────────────── */}
            {(analysisLogs.length > 0 || analysisStats) && (
              <section className="border-2 border-border bg-card p-4">
                {analysisStats && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
                    <div className="border-2 border-neon-cyan/40 bg-background p-3 font-mono text-xs">
                      <div className="text-muted-foreground">Files</div>
                      <div className="mt-1 text-xl font-bold text-neon-cyan">{analysisStats.filesAnalyzed}</div>
                    </div>
                    <div className="border-2 border-neon-red/40 bg-background p-3 font-mono text-xs">
                      <div className="text-muted-foreground">Security Issues</div>
                      <div className="mt-1 text-xl font-bold text-neon-red">{analysisStats.issuesFound}</div>
                    </div>
                    <div className="border-2 border-neon-amber/40 bg-background p-3 font-mono text-xs">
                      <div className="text-muted-foreground">Improvements</div>
                      <div className="mt-1 text-xl font-bold text-neon-amber">{analysisStats.suggestionsGenerated}</div>
                    </div>
                    <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                      <div className="text-muted-foreground">Chunks Scanned</div>
                      <div className="mt-1 text-xl font-bold">{analysisStats.chunksAnalyzed}</div>
                    </div>
                  </div>
                )}
                {analysisLogs.length > 0 && (
                  <div className="bg-background border-2 border-border p-3">
                    <div className="text-muted-foreground font-mono text-xs font-bold uppercase mb-2">Analysis Log</div>
                    <div className="max-h-28 space-y-0.5 overflow-auto">
                      {analysisLogs.map((log, i) => (
                        <div key={i} className={`font-mono text-xs ${log.type === "error" ? "text-neon-red" : log.type === "warn" ? "text-neon-amber" : log.type === "success" ? "text-neon-green" : "text-muted-foreground"}`}>
                          <span className="opacity-40 mr-2">{new Date(log.ts).toLocaleTimeString()}</span>{log.msg}
                        </div>
                      ))}
                      {analyzing && <div className="font-mono text-xs text-neon-green animate-pulse">⏳ Working…</div>}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── 3. ANALYSIS RESULTS ────────────────────────────────────── */}
            {analysisComplete && (
              <div className="grid gap-5 lg:grid-cols-2">

                {/* Security Findings */}
                <section className="border-2 border-neon-red/50 bg-card p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="font-display text-base font-extrabold uppercase flex items-center gap-2">
                      <Lock className="h-4 w-4 text-neon-red" />
                      Security Issues ({filteredFindings.length})
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={findingFilter} onChange={e => setFindingFilter(e.target.value)}
                        className="border-2 border-border bg-background px-2 py-1 font-mono text-xs">
                        <option value="ALL">All</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                        <option value="INFO">Info</option>
                      </select>
                      {selectedFindings.size > 0 && (
                        <button onClick={createGitHubIssues} disabled={isCreatingIssues}
                          className="font-mono text-xs font-bold px-3 py-1 rounded border-2 border-blue-500 bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors disabled:opacity-50">
                          {isCreatingIssues ? "Creating…" : `🐛 Open ${selectedFindings.size} on GitHub`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {filteredFindings.length === 0 && (
                      <div className="border-2 border-neon-green bg-neon-green/10 p-5 text-center rounded">
                        <CheckCircle className="h-8 w-8 text-neon-green mx-auto mb-2" />
                        <div className="font-mono text-sm font-bold text-neon-green">No Issues Found</div>
                      </div>
                    )}
                    {filteredFindings.map((finding, i) => {
                      const isExpanded = expandedFinding === i;
                      const isSelected = selectedFindings.has(i);
                      return (
                        <div key={i} className={`border-2 ${getSeverityColor(finding.severity)} transition-all ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleFinding(i)}
                                className="mt-1 h-4 w-4 cursor-pointer accent-blue-500 shrink-0" />
                              <div className="flex-1 cursor-pointer min-w-0" onClick={() => setExpandedFinding(isExpanded ? null : i)}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {getSeverityIcon(finding.severity)}
                                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-current/20 rounded shrink-0">{finding.severity}</span>
                                    <span className="font-mono text-xs font-bold truncate">{finding.type}</span>
                                  </div>
                                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                </div>
                                <div className="font-mono text-xs opacity-60 mt-0.5 flex items-center gap-1">
                                  <Code className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{finding.file}{finding.line ? `:${finding.line}` : ""}</span>
                                </div>
                                {isExpanded && (
                                  <div className="mt-3 space-y-2 border-t border-current/20 pt-3">
                                    <p className="font-mono text-xs leading-relaxed">{finding.description}</p>
                                    <div className="bg-background/50 border border-current/30 rounded p-2">
                                      <div className="font-mono text-xs font-bold opacity-60 mb-1 flex items-center gap-1"><Zap className="h-3 w-3" />FIX</div>
                                      <p className="font-mono text-xs">{finding.suggestion}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {createdIssues.length > 0 && (
                    <div className="mt-3 border-2 border-blue-500/40 bg-blue-500/5 rounded overflow-hidden">
                      <div className="px-3 py-2 border-b border-blue-500/30 font-mono text-xs font-bold text-blue-300">
                        ✅ {createdIssues.filter(x => !x.error).length}/{createdIssues.length} Issues Created
                      </div>
                      <div className="p-2 flex flex-col gap-1.5">
                        {createdIssues.map((issue, i) => (
                          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono ${issue.error ? "bg-red-500/10 text-red-400" : "bg-background text-muted-foreground"}`}>
                            {issue.error ? <span>❌ {issue.type}: {issue.error}</span> : <>
                              <span className="text-neon-green shrink-0">✅</span>
                              <span className="opacity-60 shrink-0">#{issue.number}</span>
                              <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">{issue.title}</a>
                            </>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* Improvements */}
                <section className="border-2 border-neon-amber/50 bg-card p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="font-display text-base font-extrabold uppercase flex items-center gap-2">
                      <Zap className="h-4 w-4 text-neon-amber" />
                      Improvements ({filteredSuggestions.length})
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={suggestionFilter} onChange={e => setSuggestionFilter(e.target.value)}
                        className="border-2 border-border bg-background px-2 py-1 font-mono text-xs">
                        <option value="ALL">All</option>
                        <option value="Architecture">Architecture</option>
                        <option value="Readability">Readability</option>
                        <option value="Testing">Testing</option>
                        <option value="Edge Case">Edge Cases</option>
                        <option value="Better Approach">Better Approach</option>
                      </select>
                      {selectedSuggestions.size > 0 && (
                        <button onClick={createSuggestionIssues} disabled={isCreatingSuggestionIssues}
                          className="font-mono text-xs font-bold px-3 py-1 rounded border-2 border-blue-500 bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors disabled:opacity-50">
                          {isCreatingSuggestionIssues ? "Creating…" : `🐛 Open ${selectedSuggestions.size} on GitHub`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {filteredSuggestions.length === 0 && (
                      <div className="border-2 border-blue-500 bg-blue-500/10 p-5 text-center rounded">
                        <CheckCircle className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                        <div className="font-mono text-sm font-bold text-blue-400">Code Looks Great!</div>
                      </div>
                    )}
                    {filteredSuggestions.map((suggestion, i) => {
                      const isExpanded = expandedSuggestion === i;
                      const isSelected = selectedSuggestions.has(i);
                      return (
                        <div key={i} className={`border-2 ${getPriorityColor(suggestion.priority)} transition-all ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSuggestion(i)}
                                className="mt-1 h-4 w-4 cursor-pointer accent-blue-500 shrink-0" />
                              <div className="flex-1 cursor-pointer min-w-0" onClick={() => setExpandedSuggestion(isExpanded ? null : i)}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    {getCategoryIcon(suggestion.category)}
                                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-current/20 rounded shrink-0">{suggestion.priority}</span>
                                    <span className="font-mono text-xs bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded shrink-0">{suggestion.category}</span>
                                    <span className="font-mono text-xs font-bold truncate">{suggestion.title}</span>
                                  </div>
                                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                </div>
                                <div className="font-mono text-xs opacity-60 mt-0.5 flex items-center gap-1">
                                  <Code className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{suggestion.file}{suggestion.line ? `:${suggestion.line}` : ""}</span>
                                </div>
                                {isExpanded && (
                                  <div className="mt-3 space-y-2 border-t border-current/20 pt-3">
                                    <p className="font-mono text-xs leading-relaxed">{suggestion.description}</p>
                                    {suggestion.example && (
                                      <div className="bg-background border border-current/30 rounded overflow-hidden">
                                        <div className="bg-current/10 px-2 py-1 border-b border-current/20 font-mono text-xs opacity-60">Example</div>
                                        <pre className="p-2 font-mono text-xs overflow-auto"><code>{suggestion.example}</code></pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {createdSuggestionIssues.length > 0 && (
                    <div className="mt-3 border-2 border-blue-500/40 bg-blue-500/5 rounded overflow-hidden">
                      <div className="px-3 py-2 border-b border-blue-500/30 font-mono text-xs font-bold text-blue-300">
                        ✅ {createdSuggestionIssues.filter(x => !x.error).length}/{createdSuggestionIssues.length} Issues Created
                      </div>
                      <div className="p-2 flex flex-col gap-1.5">
                        {createdSuggestionIssues.map((issue, i) => (
                          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono ${issue.error ? "bg-red-500/10 text-red-400" : "bg-background text-muted-foreground"}`}>
                            {issue.error ? <span>❌ {issue.type}: {issue.error}</span> : <>
                              <span className="text-neon-green shrink-0">✅</span>
                              <span className="opacity-60 shrink-0">#{issue.number}</span>
                              <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">{issue.title}</a>
                            </>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ── 4. REPO DETAILS ────────────────────────────────────────── */}
            <details className="group border-2 border-border bg-card" open>
              <summary className="cursor-pointer px-4 py-3 font-mono text-xs font-bold uppercase text-muted-foreground flex items-center gap-2 select-none hover:text-neon-cyan">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                Repo Details — Issues · PRs · Files
              </summary>
              <div className="px-4 pb-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground mb-2">GitHub Issues ({result.summary.issueCount})</h4>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {result.issues.length === 0 && <p className="font-mono text-xs text-muted-foreground">No issues.</p>}
                      {result.issues.map(issue => (
                        <a key={issue.id} href={issue.url} target="_blank" rel="noreferrer"
                          className="block border-2 border-border bg-background p-2 hover:border-neon-cyan font-mono text-xs">
                          <span className="text-muted-foreground">#{issue.number}</span>
                          <span className={`ml-2 px-1 rounded text-xs ${issue.state === "open" ? "bg-neon-green/20 text-neon-green" : "bg-gray-500/20 text-gray-400"}`}>{issue.state}</span>
                          <div className="mt-0.5 font-bold truncate">{issue.title}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground mb-2">Pull Requests ({result.summary.pullRequestCount})</h4>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {result.pullRequests.length === 0 && <p className="font-mono text-xs text-muted-foreground">No PRs.</p>}
                      {result.pullRequests.map(pr => (
                        <a key={pr.id} href={pr.url} target="_blank" rel="noreferrer"
                          className="block border-2 border-border bg-background p-2 hover:border-neon-green font-mono text-xs">
                          <span className="text-muted-foreground">#{pr.number}</span>
                          <span className={`ml-2 px-1 rounded text-xs ${pr.state === "open" ? "bg-neon-green/20 text-neon-green" : "bg-purple-500/20 text-purple-400"}`}>{pr.state}{pr.draft ? " draft" : ""}</span>
                          <div className="mt-0.5 font-bold truncate">{pr.title}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground mb-2">Root Files ({result.summary.rootFileCount})</h4>
                  <div className="grid gap-1.5 md:grid-cols-3 max-h-32 overflow-auto">
                    {result.rootFiles.map(file => (
                      <a key={file.path} href={file.url} target="_blank" rel="noreferrer"
                        className="border border-border bg-background p-2 font-mono text-xs hover:border-neon-amber truncate">
                        {file.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </details>

          </div>
        )}

      </div>
    </div>
  );
}
