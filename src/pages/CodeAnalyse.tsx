import { useState, useEffect, useRef } from "react";

// ── config ────────────────────────────────────────────────────────────────────
const BACKEND_URL =
  import.meta.env.VITE_REPOSCAN_URL?.trim()?.replace(/\/$/, "") ||
  import.meta.env.VITE_BACKEND_URL?.trim()?.replace(/\/$/, "") ||
  "";
const API_BASE = import.meta.env.VITE_BACKEND_URL?.trim()?.replace(/\/$/, "") || "";

// ── helpers ───────────────────────────────────────────────────────────────────
function parseRepoURL(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

const ALLOWED_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".cpp", ".c", ".cs", ".rb", ".php", ".yaml", ".yml", ".json", ".sh", ".env"];
const IGNORED_PATHS = ["node_modules/", ".git/", "dist/", "build/", "vendor/", "__pycache__/", ".next/", "coverage/"];
function shouldIncludeFile(path, size) {
  if (IGNORED_PATHS.some(p => path.includes(p))) return false;
  if (size && size > 300000) return false;
  return ALLOWED_EXTENSIONS.some(ext => path.endsWith(ext));
}

function chunkCode(content, filePath, chunkSize = 250) {
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

// ── API calls (via backend proxy) ─────────────────────────────────────────────
async function fetchFileTree(owner, repo) {
  const res = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.message) throw new Error(`GitHub: ${data.message}`);
  return data.tree || [];
}

async function fetchFileContent(owner, repo, path) {
  const normalizedPath = path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const res = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/contents/${normalizedPath}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === "base64") return atob(data.content.replace(/\n/g, ""));
  return null;
}

async function fetchGitHubAlerts(owner, repo) {
  const alerts = { codeScan: [], dependabot: [], secrets: [] };
  try {
    const r1 = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/code-scanning/alerts`);
    if (r1.ok) alerts.codeScan = await r1.json();
  } catch (_) {}
  try {
    const r2 = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/dependabot/alerts`);
    if (r2.ok) alerts.dependabot = await r2.json();
  } catch (_) {}
  try {
    const r3 = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/secret-scanning/alerts`);
    if (r3.ok) alerts.secrets = await r3.json();
  } catch (_) {}
  return alerts;
}

async function analyzeChunkWithClaude(chunk) {
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.map(b => b.text || "").join("") || "[]";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}
async function suggestImprovementsWithClaude(chunk) {
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.map(b => b.text || "").join("") || "[]";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { return []; }
}

// ── constants ─────────────────────────────────────────────────────────────────
const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const SEVERITY_COLORS = {
  CRITICAL: { bg: "#1a0000", border: "#ff1a1a", text: "#ff4444", badge: "#ff1a1a" },
  HIGH:     { bg: "#1a0800", border: "#ff6600", text: "#ff8800", badge: "#ff6600" },
  MEDIUM:   { bg: "#1a1200", border: "#ffcc00", text: "#ffdd44", badge: "#ffaa00" },
  LOW:      { bg: "#001a0a", border: "#00cc66", text: "#00ff88", badge: "#00aa55" },
  INFO:     { bg: "#00101a", border: "#0088cc", text: "#00aaff", badge: "#0077bb" },
};

// ── component ─────────────────────────────────────────────────────────────────
export default function CodeAnalyser() {
    const [suggestions, setSuggestions] = useState([]);
  const [repoUrl, setRepoUrl]       = useState("");
  const [fileLimit, setFileLimit]   = useState(4);
  const [phase, setPhase]           = useState("idle");
  const [logs, setLogs]             = useState([]);
  const [findings, setFindings]     = useState([]);
  const [ghAlerts, setGhAlerts]     = useState(null);
  const [stats, setStats]           = useState(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const [filter, setFilter]         = useState("ALL");
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [selectedFindings, setSelectedFindings] = useState(new Set());
  const [isCreatingIssues, setIsCreatingIssues] = useState(false);
  const [createdIssues, setCreatedIssues] = useState([]);
  const [parsedRepo, setParsedRepo] = useState(null);
  const logsEndRef = useRef(null);

  const addLog = (msg, type = "info") =>
    setLogs(prev => [...prev, { msg, type, ts: Date.now() }]);

  function toggleFinding(i) {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function createGitHubIssues() {
    if (selectedFindings.size === 0 || !parsedRepo) return;
    setIsCreatingIssues(true);
    try {
      const toCreate = [...selectedFindings].map(i => findings[i]);
      const res = await fetch(`${API_BASE}/api/github/create-issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: `${parsedRepo.owner}/${parsedRepo.repo}`,
          findings: toCreate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create issues");
      setCreatedIssues(data.created || []);
      setSelectedFindings(new Set());
      const ok = (data.created || []).filter(i => !i.error).length;
      addLog(`✅ Created ${ok} GitHub issue(s)`, "success");
    } catch (err) {
      addLog(`❌ Failed to create issues: ${err.message}`, "error");
    } finally {
      setIsCreatingIssues(false);
    }
  }

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function runAnalysis() {
    const parsed = parseRepoURL(repoUrl.trim());
    if (!parsed) {
      setErrorMsg("Invalid GitHub URL. Use: https://github.com/owner/repo");
      setPhase("error");
      return;
    }
    setPhase("running");
    setLogs([]); setFindings([]); setGhAlerts(null);
    setStats(null); setErrorMsg(""); setExpandedIdx(null);
    setSelectedFindings(new Set()); setCreatedIssues([]); setParsedRepo(parsed);

    const { owner, repo } = parsed;

    try {
      addLog(`🔍 Fetching file tree for ${owner}/${repo}…`);
      const tree = await fetchFileTree(owner, repo);
      const filteredFiles = tree.filter(f => f.type === "blob" && shouldIncludeFile(f.path, f.size));
      addLog(`📁 ${tree.length} total files → ${filteredFiles.length} code files found`, "success");

      addLog(`🔐 Checking GitHub native security alerts…`);
      const ghA = await fetchGitHubAlerts(owner, repo);
      setGhAlerts(ghA);
      const totalGhAlerts = ghA.codeScan.length + ghA.dependabot.length + ghA.secrets.length;
      addLog(`🛡️ GitHub alerts: ${ghA.codeScan.length} code scan, ${ghA.dependabot.length} dependabot, ${ghA.secrets.length} secrets`, totalGhAlerts > 0 ? "warn" : "success");

      const maxFiles = fileLimit === 0 ? filteredFiles.length : Math.min(filteredFiles.length, fileLimit);
      addLog(`📂 Analyzing ${maxFiles} of ${filteredFiles.length} files…`);

      const allChunks = [];
      for (let i = 0; i < maxFiles; i++) {
        const file = filteredFiles[i];
        addLog(`📄 Fetching (${i + 1}/${maxFiles}): ${file.path}`);
        const content = await fetchFileContent(owner, repo, file.path);
        if (content) {
          allChunks.push(...chunkCode(content, file.path));
        }
      }
      addLog(`📦 Total chunks to analyze: ${allChunks.length}`, "success");

      const allFindings = [];
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        addLog(`🤖 Analyzing chunk ${i + 1}/${allChunks.length}: ${chunk.filePath}…`);
        const results = await analyzeChunkWithClaude(chunk);
        allFindings.push(...results);
        if (results.length > 0)
          addLog(`⚠️  Found ${results.length} issue(s) in ${chunk.filePath}`, "warn");
      }

      const sorted = allFindings.sort((a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5)
      );
      setFindings(sorted);

      const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
      sorted.forEach(f => { counts[f.severity] = (counts[f.severity] || 0) + 1; });
      setStats({ counts, filesAnalyzed: maxFiles, chunksAnalyzed: allChunks.length, total: sorted.length });

      addLog(`✅ Done! ${sorted.length} issues found across ${maxFiles} files.`, "success");
      //
      // AI ISSUE
      //
      addLog('AI working on suggesting issues');
    const allSuggestions = [];
    addLog(`💡 Generating improvement suggestions…`);
    for (let i = 0; i < allChunks.length; i++) {
        const suggestions = await suggestImprovementsWithClaude(allChunks[i]);
        allSuggestions.push(...suggestions);
    }
    setSuggestions(allSuggestions); // new state variable
    addLog(`✅ ${allSuggestions.length} suggestions generated`, "success");
    console.log("suggestion array ",suggestions);
    setPhase("done");
    } catch (err) {
      setErrorMsg(err.message);
      addLog(`❌ ${err.message}`, "error");
      setPhase("error");
    }
  }

  const filteredFindings = filter === "ALL" ? findings : findings.filter(f => f.severity === filter);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080c10", fontFamily: "'Courier New', monospace", color: "#c8d6e5" }}>

      {/* header */}
      <div style={{ borderBottom: "1px solid #1a2535", padding: "20px 40px", display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(180deg,#0d1520,#080c10)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: "linear-gradient(135deg,#00ff88,#0088ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔬</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e8f4fd", letterSpacing: "0.05em" }}>REPO<span style={{ color: "#00ff88" }}>SCAN</span></div>
          <div style={{ fontSize: 11, color: "#4a6070", letterSpacing: "0.15em" }}>AI-POWERED CODE ANALYSIS ENGINE</div>
        </div>
      </div>

      <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>

        {/* input */}
        <div style={{ background: "#0d1520", border: "1px solid #1a2535", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#4a6070", letterSpacing: "0.12em", marginBottom: 10 }}>REPOSITORY URL</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && phase !== "running" && runAnalysis()}
              placeholder="https://github.com/owner/repository"
              style={{ flex: 1, background: "#080c10", border: "1px solid #1a2535", borderRadius: 8, padding: "12px 16px", color: "#00ff88", fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
            <button
              onClick={runAnalysis}
              disabled={phase === "running" || !repoUrl.trim()}
              style={{ background: phase === "running" ? "#1a2535" : "linear-gradient(135deg,#00cc66,#0077cc)", border: "none", borderRadius: 8, padding: "12px 28px", color: phase === "running" ? "#4a6070" : "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", cursor: phase === "running" ? "not-allowed" : "pointer" }}
            >
              {phase === "running" ? "SCANNING…" : "ANALYZE →"}
            </button>
          </div>

          {/* file limit control */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 11, color: "#4a6070", letterSpacing: "0.1em" }}>FILE LIMIT:</span>
            {[10, 25, 50, 100, 0].map(n => (
              <button key={n} onClick={() => setFileLimit(n)}
                style={{ background: fileLimit === n ? "#0088ff" : "transparent", border: `1px solid ${fileLimit === n ? "#0088ff" : "#1a2535"}`, borderRadius: 4, padding: "3px 12px", fontSize: 11, color: fileLimit === n ? "#fff" : "#4a6070", cursor: "pointer" }}>
                {n === 0 ? "ALL" : n}
              </button>
            ))}
            <span style={{ fontSize: 11, color: "#2a3a4a" }}>
              {fileLimit === 0 ? "⚠️ ALL files — may be slow & costly for large repos" : `Analyzes up to ${fileLimit} files`}
            </span>
          </div>

          {phase === "error" && <div style={{ marginTop: 12, color: "#ff4444", fontSize: 13 }}>⚠ {errorMsg}</div>}
        </div>

        {/* stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8, marginBottom: 24 }}>
            {[
              { label: "FILES",    val: stats.filesAnalyzed,      col: "#0088ff" },
              { label: "CHUNKS",   val: stats.chunksAnalyzed,     col: "#0088ff" },
              { label: "ISSUES",   val: stats.total,              col: "#ffffff" },
              { label: "CRITICAL", val: stats.counts.CRITICAL,    col: "#ff4444" },
              { label: "HIGH",     val: stats.counts.HIGH,        col: "#ff8800" },
              { label: "MEDIUM",   val: stats.counts.MEDIUM,      col: "#ffdd44" },
              { label: "LOW",      val: stats.counts.LOW,         col: "#00ff88" },
              { label: "SUGGEST",  val: suggestions.length,       col: "#00aaff" },
            ].map(s => (
              <div key={s.label} style={{ background: "#0d1520", border: "1px solid #1a2535", borderRadius: 8, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.col }}>{s.val}</div>
                <div style={{ fontSize: 10, color: "#4a6070", letterSpacing: "0.1em", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: phase === "done" ? "1fr 1fr 1fr" : "1fr", gap: 24 }}>

          {/* terminal log */}
          {logs.length > 0 && (
            <div style={{ background: "#060a0e", border: "1px solid #1a2535", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2535", fontSize: 11, color: "#4a6070", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: phase === "running" ? "#00ff88" : "#4a6070", display: "inline-block", boxShadow: phase === "running" ? "0 0 8px #00ff88" : "none" }} />
                ANALYSIS LOG
              </div>
              <div style={{ padding: 16, height: 320, overflowY: "auto", fontSize: 12, lineHeight: 1.7 }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ color: log.type === "error" ? "#ff4444" : log.type === "warn" ? "#ffaa00" : log.type === "success" ? "#00ff88" : "#6a8a9a" }}>
                    <span style={{ color: "#2a3a4a", marginRight: 8 }}>{new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}</span>
                    {log.msg}
                  </div>
                ))}
                {phase === "running" && <span style={{ color: "#00ff88" }}>█</span>}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* findings */}
          {phase === "done" && findings.length > 0 && (
            <div style={{ background: "#0d1520", border: "1px solid #1a2535", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2535", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#4a6070", letterSpacing: "0.12em", marginRight: 8 }}>SECURITY FINDINGS</span>
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(sev => (
                  <button key={sev} onClick={() => { setFilter(sev); setExpandedIdx(null); }}
                    style={{ background: filter === sev ? (SEVERITY_COLORS[sev]?.badge || "#2a3a4a") : "transparent", border: `1px solid ${filter === sev ? (SEVERITY_COLORS[sev]?.badge || "#2a3a4a") : "#1a2535"}`, borderRadius: 4, padding: "3px 10px", fontSize: 10, color: filter === sev ? "#fff" : "#4a6070", cursor: "pointer", letterSpacing: "0.08em" }}>
                    {sev}
                  </button>
                ))}
                {selectedFindings.size > 0 && (
                  <button
                    onClick={createGitHubIssues}
                    disabled={isCreatingIssues}
                    style={{ marginLeft: "auto", background: isCreatingIssues ? "#1a2535" : "linear-gradient(135deg,#0077cc,#005fa3)", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 700, color: isCreatingIssues ? "#4a6070" : "#fff", cursor: isCreatingIssues ? "not-allowed" : "pointer", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {isCreatingIssues ? "CREATING…" : `🐛 CREATE ${selectedFindings.size} ISSUE${selectedFindings.size > 1 ? "S" : ""} ON GITHUB`}
                  </button>
                )}
              </div>
              <div style={{ height: 320, overflowY: "auto" }}>
                {filteredFindings.map((f, i) => {
                  const col = SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.INFO;
                  const isOpen = expandedIdx === i;
                  const isSelected = selectedFindings.has(i);
                  return (
                    <div
                      key={i}
                      style={{ borderBottom: "1px solid #1a2535", padding: "12px 16px", background: isSelected ? `${col.bg}cc` : isOpen ? col.bg : "transparent", transition: "background 0.15s", outline: isSelected ? `1px solid ${col.border}` : "none" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFinding(i)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 14, height: 14, accentColor: col.badge, cursor: "pointer", flexShrink: 0 }}
                        />
                        <div
                          style={{ flex: 1, cursor: "pointer" }}
                          onClick={() => setExpandedIdx(isOpen ? null : i)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ background: col.badge, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.1em", flexShrink: 0 }}>{f.severity}</span>
                            <span style={{ fontSize: 13, color: col.text, fontWeight: 600 }}>{f.type}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#4a6070", marginTop: 4 }}>{f.file}{f.line ? `:${f.line}` : ""}</div>
                          {isOpen && (
                            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7 }}>
                              <div style={{ color: "#c8d6e5", marginBottom: 8 }}>{f.description}</div>
                              <div style={{ background: "#060a0e", border: `1px solid ${col.border}`, borderRadius: 6, padding: "10px 12px", color: "#00ff88", fontSize: 11 }}>
                                💡 {f.suggestion}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* improvement suggestions */}
          {phase === "done" && suggestions.length > 0 && (
            <div style={{ background: "#0d1520", border: "1px solid #1a2535", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2535", fontSize: 11, color: "#4a6070", letterSpacing: "0.12em" }}>
                💡 IMPROVEMENT SUGGESTIONS ({suggestions.length})
              </div>
              <div style={{ height: 320, overflowY: "auto" }}>
                {suggestions.map((suggestion, i) => {
                  const priorityColors = {
                    HIGH: { bg: "#1a0800", border: "#ff6600", text: "#ff8800", badge: "#ff6600" },
                    MEDIUM: { bg: "#1a1200", border: "#ffcc00", text: "#ffdd44", badge: "#ffaa00" },
                    LOW: { bg: "#001a0a", border: "#00cc66", text: "#00ff88", badge: "#00aa55" },
                  };
                  const col = priorityColors[suggestion.priority] || priorityColors.LOW;
                  const isOpen = expandedIdx === `suggestion-${i}`;
                  return (
                    <div key={`suggestion-${i}`} onClick={() => setExpandedIdx(isOpen ? null : `suggestion-${i}`)}
                      style={{ borderBottom: "1px solid #1a2535", padding: "12px 16px", cursor: "pointer", background: isOpen ? col.bg : "transparent", transition: "background 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ background: col.badge, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.1em", flexShrink: 0 }}>{suggestion.priority}</span>
                        <span style={{ background: "#0088ff", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.1em", flexShrink: 0 }}>{suggestion.category}</span>
                        <span style={{ fontSize: 13, color: col.text, fontWeight: 600 }}>{suggestion.title}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#4a6070", marginTop: 4 }}>{suggestion.file}{suggestion.line ? `:${suggestion.line}` : ""}</div>
                      {isOpen && (
                        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7 }}>
                          <div style={{ color: "#c8d6e5", marginBottom: 8 }}>{suggestion.description}</div>
                          {suggestion.example && (
                            <div style={{ background: "#060a0e", border: `1px solid ${col.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 11 }}>
                              <div style={{ color: "#00aaff", marginBottom: 4, fontWeight: 600 }}>📋 Example:</div>
                              <pre style={{ color: "#00ff88", fontSize: 10, whiteSpace: "pre-wrap", margin: 0 }}>{suggestion.example}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "done" && findings.length === 0 && suggestions.length === 0 && (
            <div style={{ background: "#0a1a0f", border: "1px solid #00aa55", borderRadius: 12, padding: 40, textAlign: "center", gridColumn: "span 2" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, color: "#00ff88", fontWeight: 700 }}>No Issues Found</div>
              <div style={{ fontSize: 13, color: "#4a6070", marginTop: 8 }}>The analyzed files appear clean with no security issues or improvement suggestions!</div>
            </div>
          )}

          {phase === "done" && findings.length === 0 && suggestions.length > 0 && (
            <div style={{ background: "#0a1a0f", border: "1px solid #00aa55", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
              <div style={{ fontSize: 18, color: "#00ff88", fontWeight: 700 }}>No Security Issues Found</div>
              <div style={{ fontSize: 13, color: "#4a6070", marginTop: 8 }}>Check the suggestions panel for improvements!</div>
            </div>
          )}
        </div>

        {/* Created GitHub issues confirmation */}
        {createdIssues.length > 0 && (
          <div style={{ marginTop: 24, background: "#001a0a", border: "1px solid #00aa55", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #00aa55", fontSize: 11, color: "#00ff88", letterSpacing: "0.12em", fontWeight: 700 }}>
              🐛 GITHUB ISSUES CREATED ({createdIssues.filter(i => !i.error).length}/{createdIssues.length})
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {createdIssues.map((issue, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: issue.error ? "#1a0000" : "#060a0e", borderRadius: 6, border: `1px solid ${issue.error ? "#ff3333" : "#00aa55"}` }}>
                  {issue.error ? (
                    <>
                      <span style={{ color: "#ff4444", fontSize: 12 }}>❌</span>
                      <span style={{ color: "#ff4444", fontSize: 12 }}>{issue.type}: {issue.error}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#00ff88", fontSize: 12 }}>✅</span>
                      <span style={{ color: "#4a6070", fontSize: 11, fontFamily: "monospace" }}>#{issue.number}</span>
                      <a href={issue.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#00aaff", fontSize: 12, textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onMouseOver={e => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseOut={e => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {issue.title}
                      </a>
                      <span style={{ color: "#2a3a4a", fontSize: 10 }}>↗</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GitHub native alerts */}
        {ghAlerts && (ghAlerts.codeScan.length + ghAlerts.dependabot.length + ghAlerts.secrets.length) > 0 && (
          <div style={{ marginTop: 24, background: "#0d1520", border: "1px solid #1a2535", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2535", fontSize: 11, color: "#4a6070", letterSpacing: "0.12em" }}>🛡️ GITHUB NATIVE ALERTS</div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {[
                { label: "Code Scanning", items: ghAlerts.codeScan,   col: "#ff8800" },
                { label: "Dependabot",    items: ghAlerts.dependabot,  col: "#ffdd44" },
                { label: "Secrets",       items: ghAlerts.secrets,     col: "#ff4444" },
              ].map(g => (
                <div key={g.label} style={{ background: "#080c10", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, color: g.col, fontWeight: 700, marginBottom: 8 }}>{g.label}</div>
                  {g.items.length === 0
                    ? <div style={{ fontSize: 11, color: "#2a3a4a" }}>No alerts / not enabled</div>
                    : g.items.slice(0, 3).map((a, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#6a8a9a", marginBottom: 4, borderLeft: `2px solid ${g.col}`, paddingLeft: 8 }}>
                        {a.rule?.description || a.security_advisory?.summary || a.secret_type_display_name || "Alert"}
                      </div>
                    ))
                  }
                  {g.items.length > 3 && <div style={{ fontSize: 11, color: "#4a6070", marginTop: 4 }}>+{g.items.length - 3} more</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080c10; }
        ::-webkit-scrollbar-thumb { background: #1a2535; border-radius: 2px; }
        input::placeholder { color: #2a3a4a; }
      `}</style>
    </div>
  );
}
