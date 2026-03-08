import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, Shield, AlertTriangle, ChevronDown, ChevronRight, Bug, Lock, Zap, Eye, Code, TestTube, Layers, BookOpen, AlertCircle, CheckCircle, Wallet, GitBranch, Plus } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContract } from "@/hooks/useContract";
import { SEVERITY_TO_NUM } from "@/lib/contract";
import WalletButton from "@/components/WalletButton";

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

// ── AI Analysis Types ─────────────────────────────────────────────────────────
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

// ── Config ────────────────────────────────────────────────────────────────────
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
  const chunks: Array<{ filePath: string; content: string; chunkIndex: number; total: number }> = [];
  for (let i = 0; i < lines.length; i += chunkSize - 20) {
    chunks.push({ filePath, content: lines.slice(i, i + chunkSize).join("\n"), chunkIndex: chunks.length, total: Math.ceil(lines.length / (chunkSize - 20)) });
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

async function analyzeChunkWithAI(chunk: { filePath: string; content: string; chunkIndex: number; total: number }): Promise<SecurityFinding[]> {
  const prompt = `You are a senior code security analyst. Analyze code from "${chunk.filePath}" (chunk ${chunk.chunkIndex + 1}/${chunk.total}).\n\nReturn ONLY valid JSON array:\n[\n  {\n    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",\n    "type": "vulnerability type",\n    "file": "${chunk.filePath}",\n    "line": "line number or null",\n    "description": "description",\n    "suggestion": "fix"\n  }\n]\nIf no issues: []\n\nCODE:\n\`\`\`\n${chunk.content.slice(0, 6000)}\n\`\`\``;

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-1.5-flash", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "[]";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return []; }
}

async function suggestImprovementsWithAI(chunk: { filePath: string; content: string; chunkIndex: number; total: number }): Promise<CodeSuggestion[]> {
  const prompt = `You are a senior software engineer. Suggest improvements for code from "${chunk.filePath}".\n\nReturn ONLY valid JSON array:\n[\n  {\n    "category": "Architecture|Readability|Edge Case|Better Approach|Testing",\n    "priority": "HIGH|MEDIUM|LOW",\n    "file": "${chunk.filePath}",\n    "line": "line number or null",\n    "title": "short title",\n    "description": "explanation",\n    "example": "optional code snippet"\n  }\n]\nIf none: []\n\nCODE:\n\`\`\`\n${chunk.content.slice(0, 6000)}\n\`\`\``;

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-1.5-flash", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "[]";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return []; }
}

const INSTALL_PENDING_REPO_KEY = "mergex:pending-github-repo";

const formatDate = (isoDate?: string) => isoDate ? new Date(isoDate).toLocaleString() : "—";

const decodeStateRepo = (encodedState: string | null) => {
  if (!encodedState) return null;
  try {
    const decoded = atob(encodedState);
    const parsed = JSON.parse(decoded);
    if (typeof parsed?.repoUrl === "string" && parsed.repoUrl.trim()) return parsed.repoUrl.trim();
    return null;
  } catch { return null; }
};

const parseRepoURL = (url: string) => {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
};

function aiSeverityToContractSeverity(sev: string): number {
  return SEVERITY_TO_NUM[sev === "INFO" ? "LOW" : sev] ?? 0;
}

export default function AddRepo() {
  return <AddRepoContent />;
}

export function AddRepoContent({ embedded = false }: { embedded?: boolean }) {
  const { isConnected } = useWallet();
  const { registerRepo, batchCreateBounties, getRepoByUrl } = useContract();

  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RepoSnapshot | null>(null);

  // ── On-chain registration ─────────────────────────────────────────────────
  const [registeredRepoId, setRegisteredRepoId] = useState<number | null>(null);
  const [existingRepoId, setExistingRepoId] = useState<number | null>(null);
  const [stakeEth, setStakeEth] = useState("0.001");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // ── Bounties from GitHub issues ───────────────────────────────────────────
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [issueBountyAmounts, setIssueBountyAmounts] = useState<Record<number, string>>({});
  const [issueSeverities, setIssueSeverities] = useState<Record<number, number>>({});
  const [isCreatingIssueBounties, setIsCreatingIssueBounties] = useState(false);
  const [issueBountiesCreated, setIssueBountiesCreated] = useState(false);

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<Array<{ msg: string; type: string; ts: number }>>([]);
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([]);
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);
  const [analysisStats, setAnalysisStats] = useState<{ filesAnalyzed: number; chunksAnalyzed: number; issuesFound: number; suggestionsGenerated: number } | null>(null);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [findingFilter, setFindingFilter] = useState("ALL");
  const [suggestionFilter, setSuggestionFilter] = useState("ALL");
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(new Set());
  const [isCreatingIssues, setIsCreatingIssues] = useState(false);
  const [createdIssues, setCreatedIssues] = useState<Array<{ number?: number; url?: string; title?: string; error?: string; type?: string }>>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [isCreatingSuggestionIssues, setIsCreatingSuggestionIssues] = useState(false);
  const [createdSuggestionIssues, setCreatedSuggestionIssues] = useState<Array<{ number?: number; url?: string; title?: string; error?: string; type?: string }>>([]);

  // ── Bounties from AI-created GitHub issues ────────────────────────────────
  const [selectedAIIssueBounties, setSelectedAIIssueBounties] = useState<Set<number>>(new Set());
  const [aiIssueBountyAmount, setAiIssueBountyAmount] = useState("0.001");
  const [isCreatingAIBounties, setIsCreatingAIBounties] = useState(false);
  const [aiIssueBountiesCreated, setAiIssueBountiesCreated] = useState(false);

  const canFetch = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);
  const activeRepoId = registeredRepoId ?? existingRepoId;
  const allCreatedIssues = [...createdIssues, ...createdSuggestionIssues].filter(i => !i.error && i.url);
  const openIssues = result?.issues.filter(i => i.state === "open") ?? [];

  const addAnalysisLog = useCallback((msg: string, type = "info") => {
    setAnalysisLogs(prev => [...prev, { msg, type, ts: Date.now() }]);
  }, []);

  // ── Color/icon helpers ────────────────────────────────────────────────────
  const getSeverityIcon = (s: string) => {
    if (s === "CRITICAL") return <AlertCircle className="h-4 w-4" />;
    if (s === "HIGH") return <AlertTriangle className="h-4 w-4" />;
    if (s === "MEDIUM") return <Eye className="h-4 w-4" />;
    if (s === "INFO") return <CheckCircle className="h-4 w-4" />;
    return <Bug className="h-4 w-4" />;
  };
  const getCategoryIcon = (c: string) => {
    if (c === "Architecture") return <Layers className="h-4 w-4" />;
    if (c === "Readability") return <BookOpen className="h-4 w-4" />;
    if (c === "Testing") return <TestTube className="h-4 w-4" />;
    if (c === "Better Approach") return <Zap className="h-4 w-4" />;
    return <Code className="h-4 w-4" />;
  };
  const getSeverityColor = (s: string) => {
    if (s === "CRITICAL") return "border-red-500 bg-red-500/10 text-red-400";
    if (s === "HIGH") return "border-orange-500 bg-orange-500/10 text-orange-400";
    if (s === "MEDIUM") return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
    if (s === "INFO") return "border-blue-500 bg-blue-500/10 text-blue-400";
    return "border-green-500 bg-green-500/10 text-green-400";
  };
  const getPriorityColor = (p: string) => {
    if (p === "HIGH") return "border-orange-500 bg-orange-500/10 text-orange-400";
    if (p === "MEDIUM") return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
    return "border-green-500 bg-green-500/10 text-green-400";
  };

  const filteredFindings = findingFilter === "ALL" ? securityFindings : securityFindings.filter(f => f.severity === findingFilter);
  const filteredSuggestions = suggestionFilter === "ALL" ? codeSuggestions : codeSuggestions.filter(s => s.category === suggestionFilter);

  const toggle = (set: Set<number>, setFn: React.Dispatch<React.SetStateAction<Set<number>>>, i: number) => {
    setFn(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  };

  // ── Post GitHub issues ────────────────────────────────────────────────────
  const postIssues = async (items: Array<{ severity: string; type: string; file: string; line?: number | string | null; description: string; suggestion: string }>) => {
    const res = await fetch("/api/github/create-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: result!.repo.fullName, findings: items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    return data.created || [];
  };

  const createGitHubIssues = async () => {
    if (selectedFindings.size === 0 || !result) return;
    setIsCreatingIssues(true);
    try { setCreatedIssues(await postIssues([...selectedFindings].map(i => securityFindings[i]))); setSelectedFindings(new Set()); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setIsCreatingIssues(false); }
  };

  const createSuggestionIssues = async () => {
    if (selectedSuggestions.size === 0 || !result) return;
    setIsCreatingSuggestionIssues(true);
    try {
      const toCreate = [...selectedSuggestions].map(i => { const s = codeSuggestions[i]; return { severity: s.priority, type: `[${s.category}] ${s.title}`, file: s.file, line: s.line, description: s.description, suggestion: s.example || "See description." }; });
      setCreatedSuggestionIssues(await postIssues(toCreate));
      setSelectedSuggestions(new Set());
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setIsCreatingSuggestionIssues(false); }
  };

  // ── On-chain: Register Repo ───────────────────────────────────────────────
  const handleRegisterRepo = async () => {
    if (!result) return;
    setIsRegistering(true);
    setRegisterError(null);
    try {
      const parsed = parseRepoURL(result.repo.htmlUrl);
      if (!parsed) throw new Error("Cannot parse repo URL");
      const id = await registerRepo(`${parsed.owner}/${parsed.repo}`, stakeEth);
      if (id) { setRegisteredRepoId(id); setStatusMessage(`Registered on-chain! Repo ID: ${id}`); }
    } catch (err) { setRegisterError(err instanceof Error ? err.message : "Registration failed"); }
    finally { setIsRegistering(false); }
  };

  const checkExistingRegistration = useCallback(async (snapshot: RepoSnapshot) => {
    const parsed = parseRepoURL(snapshot.repo.htmlUrl);
    if (!parsed) return;
    const existing = await getRepoByUrl(`${parsed.owner}/${parsed.repo}`);
    if (existing && Number(existing.id) > 0) setExistingRepoId(Number(existing.id));
  }, [getRepoByUrl]);

  // ── On-chain: Bounties from GitHub issues ─────────────────────────────────
  const handleCreateIssueBounties = async () => {
    if (!activeRepoId || selectedIssues.size === 0 || !result) return;
    setIsCreatingIssueBounties(true);
    setRegisterError(null);
    try {
      const toCreate = [...selectedIssues].map(idx => {
        const issue = openIssues[idx];
        return { url: issue.url, id: String(issue.number), title: issue.title, description: `GitHub issue #${issue.number} by ${issue.user}`, amountEth: issueBountyAmounts[idx] || "0.001", severity: issueSeverities[idx] ?? 1 };
      });
      await batchCreateBounties(activeRepoId, toCreate);
      setIssueBountiesCreated(true);
      setSelectedIssues(new Set());
      setStatusMessage(`Created ${toCreate.length} bounty(ies) on-chain!`);
    } catch (err) { setRegisterError(err instanceof Error ? err.message : "Bounty creation failed"); }
    finally { setIsCreatingIssueBounties(false); }
  };

  // ── On-chain: Bounties from AI-created GitHub issues ──────────────────────
  const handleCreateAIBounties = async () => {
    if (!activeRepoId || selectedAIIssueBounties.size === 0) return;
    setIsCreatingAIBounties(true);
    setRegisterError(null);
    try {
      const toCreate = [...selectedAIIssueBounties].map(idx => {
        const issue = allCreatedIssues[idx];
        const urlMatch = issue.url?.match(/\/issues\/(\d+)$/);
        const createdIdx = createdIssues.findIndex(c => c.url === issue.url);
        const sev = createdIdx >= 0 ? aiSeverityToContractSeverity(securityFindings[createdIdx]?.severity || "LOW") : 1;
        return { url: issue.url!, id: urlMatch ? urlMatch[1] : "0", title: issue.title || "AI-detected issue", description: securityFindings[createdIdx]?.description || issue.title || "", amountEth: aiIssueBountyAmount, severity: sev };
      });
      await batchCreateBounties(activeRepoId, toCreate);
      setAiIssueBountiesCreated(true);
      setSelectedAIIssueBounties(new Set());
      setStatusMessage(`Created ${toCreate.length} AI-detected bounty(ies) on-chain!`);
    } catch (err) { setRegisterError(err instanceof Error ? err.message : "AI bounty creation failed"); }
    finally { setIsCreatingAIBounties(false); }
  };

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const runSecurityAnalysis = useCallback(async (snapshot: RepoSnapshot) => {
    const parsed = parseRepoURL(snapshot.repo.htmlUrl);
    if (!parsed) { setError("Cannot parse repository URL"); return false; }

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
      const codeFiles = snapshot.fileTree.filter(f => f.type === "blob" && shouldIncludeFile(f.path, f.size));
      const maxFiles = Math.min(codeFiles.length, 5);
      addAnalysisLog(`📂 Analyzing ${maxFiles} of ${codeFiles.length} code files...`);

      const allChunks: Array<{ filePath: string; content: string; chunkIndex: number; total: number }> = [];
      for (let i = 0; i < maxFiles; i++) {
        addAnalysisLog(`📄 Fetching (${i + 1}/${maxFiles}): ${codeFiles[i].path}`);
        const content = await fetchFileContent(owner, repo, codeFiles[i].path);
        if (content) allChunks.push(...chunkCode(content, codeFiles[i].path));
        if (i < maxFiles - 1) await new Promise(r => setTimeout(r, 1000));
      }
      addAnalysisLog(`📦 Total chunks: ${allChunks.length}`, "success");

      const allFindings: SecurityFinding[] = [];
      for (let i = 0; i < allChunks.length; i++) {
        addAnalysisLog(`🔒 Security chunk ${i + 1}/${allChunks.length}: ${allChunks[i].filePath}...`);
        const results = await analyzeChunkWithAI(allChunks[i]);
        allFindings.push(...results);
        if (results.length > 0) addAnalysisLog(`⚠️ Found ${results.length} issue(s)`, "warn");
        await new Promise(r => setTimeout(r, 1500));
      }

      const allSuggestions: CodeSuggestion[] = [];
      addAnalysisLog(`💡 Generating suggestions...`);
      for (let i = 0; i < allChunks.length; i++) {
        addAnalysisLog(`💡 Suggestions chunk ${i + 1}/${allChunks.length}: ${allChunks[i].filePath}...`);
        allSuggestions.push(...await suggestImprovementsWithAI(allChunks[i]));
        await new Promise(r => setTimeout(r, 1500));
      }

      setSecurityFindings(allFindings);
      setCodeSuggestions(allSuggestions);
      setAnalysisStats({ filesAnalyzed: maxFiles, chunksAnalyzed: allChunks.length, issuesFound: allFindings.length, suggestionsGenerated: allSuggestions.length });
      addAnalysisLog(`✅ Done! ${allFindings.length} security issues, ${allSuggestions.length} suggestions`, "success");
      setAnalysisComplete(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      addAnalysisLog(`❌ ${msg}`, "error");
      setError(msg);
      return false;
    } finally {
      setAnalyzing(false);
    }
  }, [addAnalysisLog]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const redirectToInstall = useCallback((baseInstallUrl: string, repo: string) => {
    const trimmedRepo = repo.trim();
    if (!trimmedRepo) return;
    try { window.sessionStorage.setItem(INSTALL_PENDING_REPO_KEY, trimmedRepo); } catch { /* ignore */ }
    let nextInstallUrl = baseInstallUrl;
    try {
      const t = new URL(baseInstallUrl);
      t.searchParams.set("state", btoa(JSON.stringify({ repoUrl: trimmedRepo, ts: Date.now() })));
      nextInstallUrl = t.toString();
    } catch { /* fallback */ }
    window.location.href = nextInstallUrl;
  }, []);

  const fetchRepoSnapshot = useCallback(async (rawRepo: string) => {
    const trimmedRepo = rawRepo.trim();
    if (!trimmedRepo) { setError("Enter a GitHub repo URL or owner/repo first."); return false; }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    setRegisteredRepoId(null);
    setExistingRepoId(null);
    setIssueBountiesCreated(false);
    setAiIssueBountiesCreated(false);
    try {
      const response = await fetch(`/api/github/repo-snapshot?repoUrl=${encodeURIComponent(trimmedRepo)}`);
      const rawPayload: unknown = await response.json();
      if (!response.ok) {
        const fp = (rawPayload ?? {}) as FetchFailurePayload;
        setResult(null);
        const installUrl = fp.installUrl || (fp.appSlug ? `https://github.com/apps/${fp.appSlug}/installations/new` : null);
        if (fp.notInstalled && installUrl) { setStatusMessage("GitHub App not installed. Redirecting…"); redirectToInstall(installUrl, trimmedRepo); return false; }
        setError(fp.error || "GitHub fetch failed.");
        return false;
      }
      const sp = rawPayload as RepoSnapshot;
      setResult(sp);
      setStatusMessage("Repository fetched. Checking on-chain status...");
      await checkExistingRegistration(sp);
      setStatusMessage("Running AI analysis...");
      const ok = await runSecurityAnalysis(sp);
      setStatusMessage(ok ? "Fetch + analysis complete." : "Fetched, but analysis failed.");
      return ok;
    } catch (fetchError: unknown) {
      setResult(null);
      setError(fetchError instanceof Error ? fetchError.message : "Something went wrong.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [redirectToInstall, runSecurityAnalysis, checkExistingRegistration]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canFetch) { setError("Enter a GitHub repo URL first."); return; }
    await fetchRepoSnapshot(repoUrl);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupAction = params.get("setup_action");
    const installationId = params.get("installation_id");
    const stateRepo = decodeStateRepo(params.get("state"));
    if (!setupAction && !installationId) return;
    const storedRepo = (() => { try { return window.sessionStorage.getItem(INSTALL_PENDING_REPO_KEY); } catch { return null; } })();
    const repoFromCallback = stateRepo || storedRepo;
    if (setupAction === "request") {
      setStatusMessage("Install request submitted. Ask the org owner to approve it, then retry.");
    } else if (repoFromCallback) {
      setRepoUrl(repoFromCallback);
      setStatusMessage("Installation detected. Fetching...");
      void fetchRepoSnapshot(repoFromCallback);
    }
    try { window.sessionStorage.removeItem(INSTALL_PENDING_REPO_KEY); } catch { /* ignore */ }
    params.delete("setup_action"); params.delete("installation_id"); params.delete("state");
    const q = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [fetchRepoSnapshot]);

  return (
    <div className={embedded ? "" : "min-h-screen bg-background px-4 py-8 md:px-8"}>
      <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>

        {!embedded && (
          <div className="flex items-center justify-between border-b-2 border-border pb-4">
            <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase text-muted-foreground transition-colors hover:text-neon-green">
              <ArrowLeft className="h-4 w-4" />Back
            </Link>
            <h1 className="font-display text-2xl font-extrabold uppercase">GitHub Repo Fetch</h1>
            <WalletButton />
          </div>
        )}

        {/* ── Fetch Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-4 border-2 border-border bg-card p-4 md:p-6">
          <label htmlFor="repo-url" className="block font-mono text-xs font-bold uppercase text-muted-foreground">GitHub URL or owner/repo</label>
          <input id="repo-url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/octocat/Hello-World" className="w-full border-2 border-border bg-background px-3 py-2 font-mono text-sm focus:border-neon-green focus:outline-none" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={loading} className="brutal-btn inline-flex items-center gap-2 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-70">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Fetching</> : "Fetch Repo Data"}
            </button>
            <p className="font-mono text-xs text-muted-foreground">Requires GitHub App to be installed on the target repository.</p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">Set GitHub App Setup URL to: {window.location.origin}/add-repo</p>
        </form>

        {statusMessage && <div className="border-2 border-neon-cyan bg-neon-cyan/10 px-4 py-3 font-mono text-sm text-neon-cyan">{statusMessage}</div>}
        {error && <div className="border-2 border-neon-red bg-neon-red/10 px-4 py-3 font-mono text-sm text-neon-red">{error}</div>}
        {registerError && <div className="border-2 border-neon-amber bg-neon-amber/10 px-4 py-3 font-mono text-sm text-neon-amber">⚠ {registerError}</div>}

        {result && (
          <div className="space-y-5">

            {/* ── REPO HEADER ──────────────────────────────────────────────── */}
            <section className="border-2 border-neon-green bg-card p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-neon-green/20 flex items-center justify-center"><Shield className="h-4 w-4 text-neon-green" /></div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold uppercase text-neon-green">{result.repo.fullName}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{result.repo.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-3 font-mono text-xs text-muted-foreground">
                    <span>⭐ {result.repo.stars}</span><span>🍴 {result.repo.forks}</span>
                    <span>🔤 {result.repo.language || "n/a"}</span><span>🌿 {result.repo.defaultBranch}</span>
                  </div>
                  <a href={result.repo.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 border-2 border-border bg-background px-3 py-1 font-mono text-xs font-bold uppercase hover:border-neon-cyan hover:text-neon-cyan">
                    GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                  <button onClick={() => void runSecurityAnalysis(result)} disabled={analyzing || loading} className="brutal-btn inline-flex items-center gap-2 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-50">
                    {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Shield className="h-4 w-4" />Run Analysis</>}
                  </button>
                </div>
              </div>
            </section>

            {/* ── ON-CHAIN REGISTRATION ────────────────────────────────────── */}
            <section className="border-2 border-neon-cyan bg-card p-4 md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-neon-cyan" />
                <h3 className="font-display text-base font-extrabold uppercase text-neon-cyan">On-Chain Registration</h3>
              </div>
              {!isConnected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-xs text-muted-foreground">Connect wallet to register this repo on World Chain and create bounties.</p>
                  <WalletButton />
                </div>
              ) : (existingRepoId || registeredRepoId) ? (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-neon-green" />
                  <span className="font-mono text-sm font-bold text-neon-green">
                    {registeredRepoId ? `Registered! Repo ID: ${registeredRepoId}` : `Already registered — Repo ID: ${existingRepoId}`}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-xs text-muted-foreground">Stake ETH to register on World Chain Sepolia and unlock bounty creation.</p>
                  <div className="flex items-center gap-2">
                    <label className="font-mono text-xs font-bold uppercase text-muted-foreground">Stake (ETH)</label>
                    <input type="number" step="0.0001" min="0.000001" value={stakeEth} onChange={e => setStakeEth(e.target.value)} className="w-28 border-2 border-border bg-background px-2 py-1 font-mono text-sm focus:border-neon-cyan focus:outline-none" />
                  </div>
                  <button onClick={handleRegisterRepo} disabled={isRegistering} className="brutal-btn inline-flex items-center gap-2 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-60">
                    {isRegistering ? <><Loader2 className="h-4 w-4 animate-spin" />Registering…</> : <><Wallet className="h-4 w-4" />Register on World Chain</>}
                  </button>
                </div>
              )}
            </section>

            {/* ── BOUNTIES FROM OPEN GITHUB ISSUES ────────────────────────── */}
            {activeRepoId && openIssues.length > 0 && (
              <section className="border-2 border-neon-amber bg-card p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-neon-amber" />
                    <h3 className="font-display text-base font-extrabold uppercase text-neon-amber">Create Bounties from Open Issues ({openIssues.length})</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedIssues.size > 0 && !issueBountiesCreated && (
                      <button onClick={handleCreateIssueBounties} disabled={isCreatingIssueBounties} className="brutal-btn inline-flex items-center gap-2 border-neon-amber bg-neon-amber px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-60">
                        {isCreatingIssueBounties ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : `Create ${selectedIssues.size} Bounty(ies)`}
                      </button>
                    )}
                    {issueBountiesCreated && <span className="font-mono text-xs font-bold text-neon-green flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Created!</span>}
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto">
                  {openIssues.map((issue, idx) => (
                    <div key={issue.id} className={`border-2 p-3 ${selectedIssues.has(idx) ? "border-neon-amber bg-neon-amber/10" : "border-border bg-background"}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={selectedIssues.has(idx)} onChange={() => toggle(selectedIssues, setSelectedIssues, idx)} className="mt-1 h-4 w-4 cursor-pointer accent-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-bold truncate">#{issue.number} {issue.title}</div>
                          <div className="font-mono text-xs text-muted-foreground">by {issue.user} · {formatDate(issue.createdAt)}</div>
                        </div>
                        {selectedIssues.has(idx) && (
                          <div className="flex items-center gap-2 shrink-0">
                            <select value={issueSeverities[idx] ?? 1} onChange={e => setIssueSeverities(p => ({ ...p, [idx]: Number(e.target.value) }))} className="border border-border bg-background px-1 py-0.5 font-mono text-xs">
                              <option value={0}>LOW</option><option value={1}>MEDIUM</option><option value={2}>HIGH</option><option value={3}>CRITICAL</option>
                            </select>
                            <input type="number" step="0.001" min="0.001" placeholder="ETH" value={issueBountyAmounts[idx] || "0.001"} onChange={e => setIssueBountyAmounts(p => ({ ...p, [idx]: e.target.value }))} className="w-20 border border-border bg-background px-1 py-0.5 font-mono text-xs" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── ANALYSIS LOG + STATS ─────────────────────────────────────── */}
            {(analysisLogs.length > 0 || analysisStats) && (
              <section className="border-2 border-border bg-card p-4">
                {analysisStats && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
                    {[
                      { label: "Files", value: analysisStats.filesAnalyzed, color: "text-neon-cyan", border: "border-neon-cyan/40" },
                      { label: "Security Issues", value: analysisStats.issuesFound, color: "text-neon-red", border: "border-neon-red/40" },
                      { label: "Improvements", value: analysisStats.suggestionsGenerated, color: "text-neon-amber", border: "border-neon-amber/40" },
                      { label: "Chunks Scanned", value: analysisStats.chunksAnalyzed, color: "text-foreground", border: "border-border" },
                    ].map(s => (
                      <div key={s.label} className={`border-2 ${s.border} bg-background p-3 font-mono text-xs`}>
                        <div className="text-muted-foreground">{s.label}</div>
                        <div className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
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

            {/* ── ANALYSIS RESULTS ─────────────────────────────────────────── */}
            {analysisComplete && (
              <div className="grid gap-5 lg:grid-cols-2">

                {/* Security Findings */}
                <section className="border-2 border-neon-red/50 bg-card p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="font-display text-base font-extrabold uppercase flex items-center gap-2"><Lock className="h-4 w-4 text-neon-red" />Security ({filteredFindings.length})</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={findingFilter} onChange={e => setFindingFilter(e.target.value)} className="border-2 border-border bg-background px-2 py-1 font-mono text-xs">
                        <option value="ALL">All</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="INFO">Info</option>
                      </select>
                      {selectedFindings.size > 0 && (
                        <button onClick={createGitHubIssues} disabled={isCreatingIssues} className="font-mono text-xs font-bold px-3 py-1 border-2 border-blue-500 bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 disabled:opacity-50">
                          {isCreatingIssues ? "Creating…" : `🐛 Open ${selectedFindings.size} on GitHub`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {filteredFindings.length === 0 && (
                      <div className="border-2 border-neon-green bg-neon-green/10 p-5 text-center">
                        <CheckCircle className="h-8 w-8 text-neon-green mx-auto mb-2" />
                        <div className="font-mono text-sm font-bold text-neon-green">No Issues Found</div>
                      </div>
                    )}
                    {filteredFindings.map((f, i) => {
                      const isExp = expandedFinding === i;
                      const isSel = selectedFindings.has(i);
                      return (
                        <div key={i} className={`border-2 ${getSeverityColor(f.severity)} ${isSel ? "ring-2 ring-blue-500" : ""}`}>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <input type="checkbox" checked={isSel} onChange={() => toggle(selectedFindings, setSelectedFindings, i)} className="mt-1 h-4 w-4 cursor-pointer accent-blue-500 shrink-0" />
                              <div className="flex-1 cursor-pointer min-w-0" onClick={() => setExpandedFinding(isExp ? null : i)}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {getSeverityIcon(f.severity)}
                                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-current/20 shrink-0">{f.severity}</span>
                                    <span className="font-mono text-xs font-bold truncate">{f.type}</span>
                                  </div>
                                  {isExp ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                </div>
                                <div className="font-mono text-xs opacity-60 mt-0.5 truncate">{f.file}{f.line ? `:${f.line}` : ""}</div>
                                {isExp && (
                                  <div className="mt-3 space-y-2 border-t border-current/20 pt-3">
                                    <p className="font-mono text-xs leading-relaxed">{f.description}</p>
                                    <div className="bg-background/50 border border-current/30 p-2">
                                      <div className="font-mono text-xs font-bold opacity-60 mb-1 flex items-center gap-1"><Zap className="h-3 w-3" />FIX</div>
                                      <p className="font-mono text-xs">{f.suggestion}</p>
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
                    <div className="mt-3 border-2 border-blue-500/40 bg-blue-500/5">
                      <div className="px-3 py-2 border-b border-blue-500/30 font-mono text-xs font-bold text-blue-300">✅ {createdIssues.filter(x => !x.error).length}/{createdIssues.length} Issues Created</div>
                      <div className="p-2 flex flex-col gap-1.5">
                        {createdIssues.map((issue, i) => (
                          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 text-xs font-mono ${issue.error ? "bg-red-500/10 text-red-400" : "bg-background text-muted-foreground"}`}>
                            {issue.error ? <span>❌ {issue.error}</span> : <><span className="text-neon-green shrink-0">✅</span><span className="opacity-60 shrink-0">#{issue.number}</span><a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">{issue.title}</a></>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* Improvements */}
                <section className="border-2 border-neon-amber/50 bg-card p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="font-display text-base font-extrabold uppercase flex items-center gap-2"><Zap className="h-4 w-4 text-neon-amber" />Improvements ({filteredSuggestions.length})</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={suggestionFilter} onChange={e => setSuggestionFilter(e.target.value)} className="border-2 border-border bg-background px-2 py-1 font-mono text-xs">
                        <option value="ALL">All</option><option value="Architecture">Architecture</option><option value="Readability">Readability</option>
                        <option value="Testing">Testing</option><option value="Edge Case">Edge Cases</option><option value="Better Approach">Better Approach</option>
                      </select>
                      {selectedSuggestions.size > 0 && (
                        <button onClick={createSuggestionIssues} disabled={isCreatingSuggestionIssues} className="font-mono text-xs font-bold px-3 py-1 border-2 border-blue-500 bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 disabled:opacity-50">
                          {isCreatingSuggestionIssues ? "Creating…" : `🐛 Open ${selectedSuggestions.size} on GitHub`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {filteredSuggestions.length === 0 && (
                      <div className="border-2 border-blue-500 bg-blue-500/10 p-5 text-center">
                        <CheckCircle className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                        <div className="font-mono text-sm font-bold text-blue-400">Code Looks Great!</div>
                      </div>
                    )}
                    {filteredSuggestions.map((s, i) => {
                      const isExp = expandedSuggestion === i;
                      const isSel = selectedSuggestions.has(i);
                      return (
                        <div key={i} className={`border-2 ${getPriorityColor(s.priority)} ${isSel ? "ring-2 ring-blue-500" : ""}`}>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <input type="checkbox" checked={isSel} onChange={() => toggle(selectedSuggestions, setSelectedSuggestions, i)} className="mt-1 h-4 w-4 cursor-pointer accent-blue-500 shrink-0" />
                              <div className="flex-1 cursor-pointer min-w-0" onClick={() => setExpandedSuggestion(isExp ? null : i)}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    {getCategoryIcon(s.category)}
                                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-current/20 shrink-0">{s.priority}</span>
                                    <span className="font-mono text-xs bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 shrink-0">{s.category}</span>
                                    <span className="font-mono text-xs font-bold truncate">{s.title}</span>
                                  </div>
                                  {isExp ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                </div>
                                <div className="font-mono text-xs opacity-60 mt-0.5 truncate">{s.file}{s.line ? `:${s.line}` : ""}</div>
                                {isExp && (
                                  <div className="mt-3 space-y-2 border-t border-current/20 pt-3">
                                    <p className="font-mono text-xs leading-relaxed">{s.description}</p>
                                    {s.example && (
                                      <div className="bg-background border border-current/30 overflow-hidden">
                                        <div className="bg-current/10 px-2 py-1 border-b border-current/20 font-mono text-xs opacity-60">Example</div>
                                        <pre className="p-2 font-mono text-xs overflow-auto"><code>{s.example}</code></pre>
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
                    <div className="mt-3 border-2 border-blue-500/40 bg-blue-500/5">
                      <div className="px-3 py-2 border-b border-blue-500/30 font-mono text-xs font-bold text-blue-300">✅ {createdSuggestionIssues.filter(x => !x.error).length}/{createdSuggestionIssues.length} Issues Created</div>
                      <div className="p-2 flex flex-col gap-1.5">
                        {createdSuggestionIssues.map((issue, i) => (
                          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 text-xs font-mono ${issue.error ? "bg-red-500/10 text-red-400" : "bg-background text-muted-foreground"}`}>
                            {issue.error ? <span>❌ {issue.error}</span> : <><span className="text-neon-green shrink-0">✅</span><span className="opacity-60 shrink-0">#{issue.number}</span><a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">{issue.title}</a></>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ── BOUNTIES FROM AI-CREATED GITHUB ISSUES ──────────────────── */}
            {activeRepoId && allCreatedIssues.length > 0 && (
              <section className="border-2 border-neon-green/50 bg-card p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-neon-green" />
                    <h3 className="font-display text-base font-extrabold uppercase text-neon-green">Create Bounties from AI Issues ({allCreatedIssues.length})</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="font-mono text-xs font-bold uppercase text-muted-foreground">Reward (ETH each)</label>
                    <input type="number" step="0.001" min="0.001" value={aiIssueBountyAmount} onChange={e => setAiIssueBountyAmount(e.target.value)} className="w-20 border-2 border-border bg-background px-2 py-1 font-mono text-xs" />
                  </div>
                </div>
                {selectedAIIssueBounties.size > 0 && !aiIssueBountiesCreated && (
                  <button onClick={handleCreateAIBounties} disabled={isCreatingAIBounties} className="brutal-btn mb-3 inline-flex items-center gap-2 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-60">
                    {isCreatingAIBounties ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : `Create ${selectedAIIssueBounties.size} Bounty(ies)`}
                  </button>
                )}
                {aiIssueBountiesCreated && <span className="font-mono text-xs font-bold text-neon-green flex items-center gap-1 mb-3"><CheckCircle className="h-3.5 w-3.5" /> Created!</span>}
                <div className="max-h-48 space-y-2 overflow-auto">
                  {allCreatedIssues.map((issue, idx) => (
                    <div key={idx} className={`border-2 p-3 ${selectedAIIssueBounties.has(idx) ? "border-neon-green bg-neon-green/10" : "border-border bg-background"}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedAIIssueBounties.has(idx)} onChange={() => toggle(selectedAIIssueBounties, setSelectedAIIssueBounties, idx)} className="h-4 w-4 cursor-pointer accent-green-500 shrink-0" />
                        <span className="font-mono text-xs opacity-60 shrink-0">#{issue.number}</span>
                        <a href={issue.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-bold text-neon-cyan hover:underline truncate">{issue.title}</a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── REPO DETAILS ─────────────────────────────────────────────── */}
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
                        <a key={issue.id} href={issue.url} target="_blank" rel="noreferrer" className="block border-2 border-border bg-background p-2 hover:border-neon-cyan font-mono text-xs">
                          <span className="text-muted-foreground">#{issue.number}</span>
                          <span className={`ml-2 px-1 text-xs ${issue.state === "open" ? "bg-neon-green/20 text-neon-green" : "bg-gray-500/20 text-gray-400"}`}>{issue.state}</span>
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
                        <a key={pr.id} href={pr.url} target="_blank" rel="noreferrer" className="block border-2 border-border bg-background p-2 hover:border-neon-green font-mono text-xs">
                          <span className="text-muted-foreground">#{pr.number}</span>
                          <span className={`ml-2 px-1 text-xs ${pr.state === "open" ? "bg-neon-green/20 text-neon-green" : "bg-purple-500/20 text-purple-400"}`}>{pr.state}{pr.draft ? " draft" : ""}</span>
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
                      <a key={file.path} href={file.url} target="_blank" rel="noreferrer" className="border border-border bg-background p-2 font-mono text-xs hover:border-neon-amber truncate">{file.name}</a>
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
