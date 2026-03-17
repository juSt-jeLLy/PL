import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, ArrowLeft, Search, AlertTriangle, AlertCircle,
  CheckCircle, Info, Loader2, ExternalLink, RefreshCw, FileCheck
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useContract } from "@/hooks/useContract";
import WalletButton from "@/components/WalletButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const BACKEND = "http://localhost:3001";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface Discrepancy {
  type: string;
  severity: Severity;
  issueNumber?: number;
  issueTitle?: string;
  issueUrl?: string;
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
  bountyId?: string;
  bountyStatus?: string;
  description: string;
}

interface AuditReport {
  repoUrl: string;
  timestamp: string;
  stats: {
    totalIssues: number;
    mergedPRs: number;
    discrepanciesFound: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  discrepancies: Discrepancy[];
  aiAnalysis: {
    overallRisk: string;
    riskScore: number;
    summary: string;
    findings: { type: string; suspicionScore: number; explanation: string; action: string }[];
  } | null;
  cid: string | null;
}

const SEV_STYLE: Record<Severity, string> = {
  CRITICAL: "border-neon-red bg-neon-red/10 text-neon-red",
  HIGH: "border-neon-amber bg-neon-amber/10 text-neon-amber",
  MEDIUM: "border-neon-cyan bg-neon-cyan/10 text-neon-cyan",
  LOW: "border-border text-muted-foreground",
};

const SEV_ICON: Record<Severity, React.ElementType> = {
  CRITICAL: AlertCircle,
  HIGH: AlertTriangle,
  MEDIUM: Info,
  LOW: Info,
};

const RISK_STYLE: Record<string, string> = {
  CRITICAL: "text-neon-red border-neon-red",
  HIGH: "text-neon-amber border-neon-amber",
  MEDIUM: "text-neon-cyan border-neon-cyan",
  LOW: "text-neon-green border-neon-green",
};

const TYPE_LABEL: Record<string, string> = {
  MERGED_PR_REJECTED_BOUNTY: "Merged PR / Rejected Bounty",
  CLOSED_ISSUE_UNSETTLED_BOUNTY: "Closed Issue / Unsettled Bounty",
  ASSIGNED_BOUNTY_CLOSED_ISSUE: "Assigned Bounty / Closed Issue",
  UNREGISTERED_OPEN_ISSUE: "Unregistered Open Issue",
};

export default function AuditPage() {
  const { isConnected } = useWallet();
  const { getRepoByUrl, getRepoBounties } = useContract();

  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [pinnedCid, setPinnedCid] = useState<string | null>(null);

  const log = (msg: string) => setStatusLog(prev => [...prev, msg]);

  async function runAudit() {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setStatusLog([]);
    setPinnedCid(null);

    try {
      log("Resolving repo on-chain...");
      // Contract stores repos as "owner/repo" — extract from full URL if needed
      const urlTrimmed = repoUrl.trim().replace(/\/$/, "");
      const ghMatch = urlTrimmed.match(/github\.com\/([^/]+\/[^/]+)/);
      const lookupKey = ghMatch ? ghMatch[1] : urlTrimmed;
      const repoData = await getRepoByUrl(lookupKey);
      if (!repoData || Number(repoData.id) === 0) throw new Error("Repo not found on-chain. Register it first via Add Repo.");

      log(`Found repo #${repoData.id} on-chain. Fetching bounties...`);
      const bounties = await getRepoBounties(repoData.id);
      log(`Found ${bounties.length} on-chain bounties. Fetching GitHub data...`);

      // Convert BigInt values to strings for JSON serialization
      const serializedBounties = JSON.parse(
        JSON.stringify(bounties, (_, v) => (typeof v === "bigint" ? v.toString() : v))
      );

      const res = await fetch(`${BACKEND}/api/audit-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), bounties: serializedBounties }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");

      log(`Scanned ${data.stats.totalIssues} issues and ${data.stats.mergedPRs} merged PRs.`);
      log(`Found ${data.stats.discrepanciesFound} discrepancies. Running AI analysis...`);
      if (data.cid) { setPinnedCid(data.cid); log(`Audit report pinned to Filecoin.`); }
      else log("Pinata not configured — report not pinned.");

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background bg-dot-grid">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-1.5 font-mono text-sm font-bold uppercase text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:block">Dashboard</span>
            </Link>
            <div className="h-5 w-0.5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center border-2 border-border bg-neon-green">
                <Shield className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-extrabold uppercase">
                merge<span className="text-neon-green">X</span>
              </span>
              <span className="font-mono text-sm text-muted-foreground">/ AI Audit</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="h-5 w-5 text-neon-cyan" />
            <h1 className="font-display text-2xl font-extrabold uppercase">AI Audit</h1>
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            Cross-references GitHub state vs on-chain contract state to detect discrepancies. Audit reports are pinned to Filecoin as immutable proof.
          </p>
        </div>

        {/* Input */}
        <div className="brutal-card p-4 space-y-3">
          <div className="font-mono text-sm font-bold uppercase text-muted-foreground">// repo to audit</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && runAudit()}
              className="flex-1 border-2 border-border bg-background px-3 py-2 font-mono text-sm focus:border-neon-cyan focus:outline-none"
            />
            {!isConnected ? (
              <WalletButton />
            ) : (
              <button
                onClick={runAudit}
                disabled={loading || !repoUrl.trim()}
                className="brutal-btn flex items-center gap-2 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Auditing..." : "Run Audit"}
              </button>
            )}
          </div>
          {!isConnected && (
            <p className="font-mono text-sm text-neon-amber">Connect wallet to fetch on-chain bounty data.</p>
          )}
        </div>

        {/* Status log */}
        {statusLog.length > 0 && (
          <div className="border-2 border-border bg-card p-4">
            <div className="mb-2 font-mono text-sm uppercase tracking-wider text-muted-foreground">// audit_log</div>
            <div className="space-y-1">
              {statusLog.map((msg, i) => (
                <div key={i} className="flex gap-3 font-mono text-sm">
                  <span className="text-neon-green shrink-0">›</span>
                  <span>{msg}</span>
                </div>
              ))}
              {pinnedCid && (
                <div className="flex gap-3 font-mono text-sm text-neon-amber">
                  <span className="shrink-0">›</span>
                  <span>
                    CID:{" "}
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${pinnedCid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-foreground break-all"
                    >
                      {pinnedCid}
                    </a>
                  </span>
                </div>
              )}
              {loading && (
                <div className="flex gap-3 font-mono text-sm text-neon-cyan">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
                  <span>Running...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border-2 border-neon-red bg-neon-red/10 p-4 font-mono text-sm text-neon-red">
            {error}
          </div>
        )}

        {/* Results */}
        {report && (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="brutal-card p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-display text-xl font-extrabold uppercase">Audit Results</div>
                <div className="flex items-center gap-2">
                  {report.aiAnalysis && (
                    <span className={`border-2 px-3 py-1 font-mono text-sm font-bold uppercase ${RISK_STYLE[report.aiAnalysis.overallRisk] || "text-muted-foreground border-border"}`}>
                      {report.aiAnalysis.overallRisk} RISK
                    </span>
                  )}
                  <span className="font-mono text-sm text-muted-foreground">
                    {new Date(report.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: "Issues Scanned", value: report.stats.totalIssues, color: "text-foreground" },
                  { label: "Merged PRs", value: report.stats.mergedPRs, color: "text-foreground" },
                  { label: "Discrepancies", value: report.stats.discrepanciesFound, color: report.stats.discrepanciesFound > 0 ? "text-neon-amber" : "text-neon-green" },
                  { label: "Risk Score", value: report.aiAnalysis ? `${report.aiAnalysis.riskScore}/100` : "N/A", color: "text-neon-cyan" },
                ].map(s => (
                  <div key={s.label} className="border-2 border-border bg-surface-2 p-3">
                    <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Severity breakdown */}
              {report.stats.discrepanciesFound > 0 && (
                <div className="flex flex-wrap gap-2">
                  {report.stats.critical > 0 && <span className="border-2 border-neon-red bg-neon-red/10 px-2 py-0.5 font-mono text-sm font-bold text-neon-red">{report.stats.critical} CRITICAL</span>}
                  {report.stats.high > 0 && <span className="border-2 border-neon-amber bg-neon-amber/10 px-2 py-0.5 font-mono text-sm font-bold text-neon-amber">{report.stats.high} HIGH</span>}
                  {report.stats.medium > 0 && <span className="border-2 border-neon-cyan bg-neon-cyan/10 px-2 py-0.5 font-mono text-sm font-bold text-neon-cyan">{report.stats.medium} MEDIUM</span>}
                  {report.stats.low > 0 && <span className="border-2 border-border px-2 py-0.5 font-mono text-sm font-bold text-muted-foreground">{report.stats.low} LOW</span>}
                </div>
              )}
            </div>

            {/* AI Summary */}
            {report.aiAnalysis && (
              <div className="brutal-card-cyan p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-neon-cyan" />
                  <span className="font-mono text-sm font-bold uppercase text-neon-cyan">AI Assessment</span>
                </div>
                <p className="font-mono text-sm text-foreground">{report.aiAnalysis.summary}</p>
              </div>
            )}

            {/* Clean bill */}
            {report.stats.discrepanciesFound === 0 && (
              <div className="brutal-card-green p-6 text-center">
                <CheckCircle className="mx-auto mb-3 h-10 w-10 text-neon-green" />
                <div className="font-display text-xl font-extrabold uppercase text-neon-green">No Discrepancies Found</div>
                <p className="mt-2 font-mono text-sm text-muted-foreground">
                  All GitHub issues and PRs match on-chain bounty states. This repo appears to be operating with integrity.
                </p>
              </div>
            )}

            {/* Discrepancy list */}
            {report.discrepancies.length > 0 && (
              <div className="space-y-3">
                <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">// discrepancies</div>
                {report.discrepancies.map((d, i) => {
                  const Icon = SEV_ICON[d.severity];
                  const finding = report.aiAnalysis?.findings.find(f => f.type === d.type);
                  return (
                    <div key={i} className={`border-2 p-4 space-y-3 ${SEV_STYLE[d.severity]}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="font-mono text-sm font-bold uppercase">{d.severity}</span>
                        <span className="font-mono text-sm font-bold">{TYPE_LABEL[d.type] || d.type}</span>
                        {d.bountyId && <span className="font-mono text-sm text-muted-foreground">Bounty #{d.bountyId}</span>}
                      </div>

                      <p className="font-mono text-sm text-foreground">{d.description}</p>

                      <div className="flex flex-wrap gap-2">
                        {d.issueUrl && (
                          <a href={d.issueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm hover:underline">
                            Issue #{d.issueNumber} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {d.prUrl && (
                          <a href={d.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm hover:underline">
                            PR #{d.prNumber} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {d.bountyStatus && (
                          <span className="font-mono text-sm text-muted-foreground">On-chain: {d.bountyStatus}</span>
                        )}
                      </div>

                      {finding && (
                        <div className="border-t border-current/20 pt-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold uppercase text-muted-foreground">AI:</span>
                            <span className="font-mono text-sm font-bold">Suspicion {finding.suspicionScore}/10</span>
                          </div>
                          <p className="font-mono text-sm text-muted-foreground">{finding.explanation}</p>
                          <p className="font-mono text-sm font-bold">→ {finding.action}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filecoin CID */}
            <div className={`border-2 p-4 space-y-2 ${report.cid ? "border-neon-amber bg-neon-amber/10" : "border-border bg-surface-2"}`}>
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${report.cid ? "text-neon-amber" : "text-muted-foreground"}`} />
                <span className={`font-mono text-sm font-bold uppercase ${report.cid ? "text-neon-amber" : "text-muted-foreground"}`}>
                  Filecoin Proof
                </span>
              </div>
              {report.cid ? (
                <>
                  <div className="font-mono text-sm break-all text-foreground">{report.cid}</div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${report.cid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-sm text-neon-amber hover:underline"
                    >
                      View on Pinata <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={`https://ipfs.io/ipfs/${report.cid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-sm text-muted-foreground hover:underline"
                    >
                      View on IPFS <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">This audit report is permanently pinned. Use this CID as evidence in any dispute.</p>
                </>
              ) : (
                <p className="font-mono text-sm text-muted-foreground">
                  Add <code className="bg-surface-3 px-1">PINATA_JWT</code> to backend .env to enable Filecoin pinning.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
