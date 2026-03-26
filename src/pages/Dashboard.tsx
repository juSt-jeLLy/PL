import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Shield, GitBranch, Brain,
  CheckCircle, Clock, AlertTriangle, ArrowLeft, Plus,
  Users, Database, Zap, ExternalLink, RefreshCw,
  TrendingUp, Lock, GitPullRequest, Loader2, Building2,
  XCircle, DollarSign, Wallet, ChevronDown, ChevronRight,
} from "lucide-react";
import { ethers } from "ethers";
import { AddRepoContent } from "./AddRepo";
import WalletButton from "@/components/WalletButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";
import { useContract } from "@/hooks/useContract";
import { OnChainBounty, OnChainRepo, SEVERITY_FROM_NUM, STATUS_FROM_NUM } from "@/lib/contract";

// ─── PR Analysis Component ───────────────────────────────────────────────────
const BACKEND = "http://localhost:3001";

interface PRAnalysisResult {
  verdict: "APPROVED" | "NEEDS_WORK" | "REJECTED";
  confidence: number;
  summary: string;
  issueAddressed: boolean;
  keyPoints: string[];
  concerns: string[];
  codeQuality?: string;
  recommendation: string;
}

function PRAnalysisPanel({ prUrl, issueUrl, issueTitle, issueDescription }: {
  prUrl: string; issueUrl: string; issueTitle?: string; issueDescription?: string;
}) {
  const [result, setResult] = useState<PRAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${BACKEND}/api/analyze-pr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl, issueUrl, issueTitle, issueDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.analysis);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const verdictStyle = {
    APPROVED: "border-neon-green bg-neon-green/10 text-neon-green",
    NEEDS_WORK: "border-neon-amber bg-neon-amber/10 text-neon-amber",
    REJECTED: "border-neon-red bg-neon-red/10 text-neon-red",
  };

  return (
    <div className="space-y-3">
      {!result && (
        <button onClick={analyze} disabled={loading}
          className="brutal-btn flex items-center gap-1.5 border-neon-cyan bg-neon-cyan/10 px-3 py-1.5 font-mono text-sm font-bold text-neon-cyan disabled:opacity-60">
          {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing PR...</> : <><Brain className="h-3.5 w-3.5" /> AI ANALYZE PR</>}
        </button>
      )}
      {error && <div className="font-mono text-sm text-neon-red">{error}</div>}
      {result && (
        <div className="border-2 border-border bg-surface-2 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-neon-cyan" />
              <span className="font-mono text-sm font-bold uppercase text-neon-cyan">AI Agent Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`border-2 px-2 py-0.5 font-mono text-sm font-bold uppercase ${verdictStyle[result.verdict]}`}>{result.verdict}</span>
              <span className="font-mono text-sm text-muted-foreground">{result.confidence}% confidence</span>
            </div>
          </div>

          <p className="font-mono text-sm text-foreground">{result.summary}</p>

          <div className="flex items-center gap-2 font-mono text-sm">
            {result.issueAddressed
              ? <><CheckCircle className="h-3.5 w-3.5 text-neon-green" /><span className="text-neon-green">Issue is addressed by this PR</span></>
              : <><XCircle className="h-3.5 w-3.5 text-neon-red" /><span className="text-neon-red">Issue NOT fully addressed</span></>}
          </div>

          {result.keyPoints.length > 0 && (
            <div className="space-y-1">
              <div className="font-mono text-sm font-bold uppercase text-muted-foreground">Key Findings</div>
              {result.keyPoints.map((p, i) => (
                <div key={i} className="flex gap-2 font-mono text-sm"><span className="text-neon-green shrink-0">→</span><span>{p}</span></div>
              ))}
            </div>
          )}

          {result.concerns.length > 0 && (
            <div className="space-y-1">
              <div className="font-mono text-sm font-bold uppercase text-muted-foreground">Concerns</div>
              {result.concerns.map((c, i) => (
                <div key={i} className="flex gap-2 font-mono text-sm"><span className="text-neon-amber shrink-0">!</span><span className="text-neon-amber">{c}</span></div>
              ))}
            </div>
          )}

          {result.codeQuality && (
            <div className="border-2 border-border bg-background px-3 py-2 font-mono text-sm">
              <span className="font-bold text-muted-foreground uppercase">Code Quality: </span>
              <span>{result.codeQuality}</span>
            </div>
          )}

          <div className="border-t-2 border-border pt-2 font-mono text-sm">
            <span className="font-bold text-muted-foreground uppercase">Recommendation: </span>
            <span>{result.recommendation}</span>
          </div>

          <button onClick={() => setResult(null)} className="font-mono text-sm text-muted-foreground hover:text-foreground underline">re-analyze</button>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DashboardTab = "repos" | "bounties" | "my-issues" | "org";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtEth(wei: bigint): string {
  const eth = Number(ethers.formatEther(wei));
  if (!Number.isFinite(eth)) return "0";
  if (eth === 0) return "0";
  const decimals = eth < 0.001 ? 6 : 4;
  return eth.toFixed(decimals).replace(/\.?0+$/, "");
}
function stakeForPercent(amount: bigint, percent: number): string {
  const pct = BigInt(percent);
  const wei = (amount * pct) / 100n;
  return fmtEth(wei);
}
function timeSince(ts: bigint): string {
  const diff = Math.floor(Date.now() / 1000) - Number(ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function deadlineLabel(deadline: bigint): { label: string; expired: boolean } {
  const secsLeft = Number(deadline) - Math.floor(Date.now() / 1000);
  const expired = secsLeft < 0;
  const abs = Math.abs(secsLeft);
  const label = abs < 3600 ? `${Math.floor(abs / 60)}m` : abs < 86400 ? `${Math.floor(abs / 3600)}h` : `${Math.floor(abs / 86400)}d`;
  return { label: expired ? `${label} overdue` : `${label} left`, expired };
}
function formatSev(n: number): string { return SEVERITY_FROM_NUM[n] ?? "LOW"; }
function formatStatus(n: number): string { return STATUS_FROM_NUM[n] ?? "OPEN"; }

const SEV_STYLE: Record<string, string> = {
  CRITICAL: "border-neon-red bg-neon-red/10 text-neon-red",
  HIGH: "border-neon-amber bg-neon-amber/10 text-neon-amber",
  MEDIUM: "border-yellow-500 bg-yellow-500/10 text-yellow-400",
  LOW: "border-border bg-surface-2 text-muted-foreground",
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: "text-neon-green",
  ASSIGNED: "text-neon-cyan",
  PR_SUBMITTED: "text-neon-amber",
  MERGED: "text-neon-green",
  COMPLETED: "text-muted-foreground",
  CANCELLED: "text-neon-red",
};


// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { address, isConnected } = useWallet();
  const {
    getAllBounties, getContributorBounties, getOrgRepos, getRepoBounties, getRepo,
    takeBounty, submitPR, claimBounty, claimExpiredBounty,
    approveMerge, rejectPR, cancelBounty, increaseBounty, fundRepo, withdrawRepoFunds,
  } = useContract();

  const readTabFromQuery = (): DashboardTab => {
    const tab = searchParams.get("tab");
    if (["repos","bounties","my-issues","org"].includes(tab ?? "")) return tab as DashboardTab;
    return "bounties";
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(readTabFromQuery);

  // Bounties tab state
  const [bounties, setBounties] = useState<OnChainBounty[]>([]);
  const [loadingBounties, setLoadingBounties] = useState(false);
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [stakeInputs, setStakeInputs] = useState<Record<string, string>>({});
  const [takingId, setTakingId] = useState<bigint | null>(null);

  // My Issues state
  const [myBounties, setMyBounties] = useState<OnChainBounty[]>([]);
  const [prInputs, setPrInputs] = useState<Record<string, string>>({});
  const [submittingPRId, setSubmittingPRId] = useState<bigint | null>(null);
  const [claimingId, setClaimingId] = useState<bigint | null>(null);

  // Org tab state
  const [orgRepos, setOrgRepos] = useState<OnChainRepo[]>([]);
  const [orgBounties, setOrgBounties] = useState<Record<string, OnChainBounty[]>>({});
  const [orgReviewOpen, setOrgReviewOpen] = useState<Set<string>>(new Set());
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<bigint | null>(null);
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  const [increaseAmounts, setIncreaseAmounts] = useState<Record<string, string>>({});
  const [fundingRepoId, setFundingRepoId] = useState<bigint | null>(null);
  const [withdrawingRepoId, setWithdrawingRepoId] = useState<bigint | null>(null);
  const [cancellingId, setCancellingId] = useState<bigint | null>(null);
  const [increasingId, setIncreasingId] = useState<bigint | null>(null);
  const [approvingId, setApprovingId] = useState<bigint | null>(null);
  const [rejectingId, setRejectingId] = useState<bigint | null>(null);
  const [claimExpiredId, setClaimExpiredId] = useState<bigint | null>(null);

  // Shared tx state
  const [txStatus, setTxStatus] = useState("");
  const [txError, setTxError] = useState("");
  const [analysisRepoId, setAnalysisRepoId] = useState<bigint | null>(null);
  const [analysisRepoUrl, setAnalysisRepoUrl] = useState<string | null>(null);

  const normalizeRepoUrl = useCallback((url?: string | null) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("http") ? trimmed : `https://github.com/${trimmed}`;
  }, []);

  const resolveRepoUrl = useCallback(async (repoId: bigint) => {
    const fromOrg = orgRepos.find((r) => r.id === repoId);
    if (fromOrg?.repoUrl) return normalizeRepoUrl(fromOrg.repoUrl);
    const fetched = await getRepo(Number(repoId));
    return fetched?.repoUrl ? normalizeRepoUrl(fetched.repoUrl) : null;
  }, [getRepo, normalizeRepoUrl, orgRepos]);

  const resolveRepoIdForBounty = useCallback((bountyId: bigint) => {
    const inAll = bounties.find((b) => b.id === bountyId);
    if (inAll) return inAll.repoId;
    const inMine = myBounties.find((b) => b.id === bountyId);
    if (inMine) return inMine.repoId;
    for (const list of Object.values(orgBounties)) {
      const found = list.find((b) => b.id === bountyId);
      if (found) return found.repoId;
    }
    return null;
  }, [bounties, myBounties, orgBounties]);

  const toggleOrgReview = useCallback((key: string) => {
    setOrgReviewOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const fireAudit = useCallback(async (
    repoId: bigint | null,
    action: string,
    details?: Record<string, unknown>
  ) => {
    if (!repoId) return;
    try {
      const repoUrl = await resolveRepoUrl(repoId);
      if (!repoUrl) return;
      let bountiesSerialized: unknown[] = [];
      try {
        const rawBounties = await getRepoBounties(Number(repoId));
        bountiesSerialized = JSON.parse(
          JSON.stringify(rawBounties, (_, v) => (typeof v === "bigint" ? v.toString() : v))
        );
      } catch (err) {
        console.warn("audit bounties fetch failed:", err);
      }
      await fetch("/api/audit-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          bounties: bountiesSerialized,
          eventOnly: true,
          event: {
            name: "app_action",
            action,
            details,
            source: "dashboard",
            ts: new Date().toISOString(),
          },
        }),
      });
    } catch (err) {
      console.warn("audit trigger failed:", err);
    }
  }, [getRepoBounties, resolveRepoUrl]);

  const setTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    const p = new URLSearchParams(searchParams);
    if (tab === "bounties") p.delete("tab"); else p.set("tab", tab);
    setSearchParams(p, { replace: true });
  };

  useEffect(() => {
    const next = readTabFromQuery();
    if (next !== activeTab) setActiveTab(next);
  }, [searchParams]);

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadBounties = useCallback(async () => {
    setLoadingBounties(true);
    try { setBounties(await getAllBounties()); }
    finally { setLoadingBounties(false); }
  }, [getAllBounties]);

  const loadMyBounties = useCallback(async () => {
    if (!address) return;
    try { setMyBounties(await getContributorBounties(address)); } catch { /* ignore */ }
  }, [address, getContributorBounties]);

  const loadOrgData = useCallback(async () => {
    if (!address) return;
    setLoadingOrg(true);
    try {
      const repos = await getOrgRepos(address);
      setOrgRepos(repos);
      const bountiesMap: Record<string, OnChainBounty[]> = {};
      await Promise.all(repos.map(async (r) => {
        bountiesMap[r.id.toString()] = await getRepoBounties(Number(r.id));
      }));
      setOrgBounties(bountiesMap);
    } finally { setLoadingOrg(false); }
  }, [address, getOrgRepos, getRepoBounties]);

  useEffect(() => { loadBounties(); }, [loadBounties]);
  useEffect(() => { if (activeTab === "my-issues" && isConnected) loadMyBounties(); }, [activeTab, isConnected, loadMyBounties]);
  useEffect(() => { if (activeTab === "org" && isConnected) loadOrgData(); }, [activeTab, isConnected, loadOrgData]);

  useEffect(() => {
    if (!selectedId) return;
    const b = bounties.find((x) => x.id === selectedId);
    if (!b) return;
    const key = selectedId.toString();
    setStakeInputs((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: stakeForPercent(b.amount, 15) };
    });
  }, [selectedId, bounties]);

  const openCount = bounties.filter((b) => b.status === 0).length;

  // ── Tx helper ───────────────────────────────────────────────────────────────
  async function runTx(label: string, fn: () => Promise<unknown>, onDone?: () => Promise<void>) {
    setTxError(""); setTxStatus(`${label}...`);
    try {
      await fn();
      setTxStatus(`${label} — done! Refreshing...`);
      if (onDone) await onDone();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message.slice(0, 120) : "Transaction failed");
    } finally { setTxStatus(""); }
  }

  // ── Contributor handlers ─────────────────────────────────────────────────────
  async function handleTakeBounty(bountyId: bigint, amountWei: bigint) {
    const stakeEth = stakeInputs[bountyId.toString()] || "";
    if (!stakeEth) { setTxError("Enter stake amount (10–20% of bounty)"); return; }
    const stakeWei = ethers.parseEther(stakeEth);
    const min = amountWei / 10n, max = (amountWei * 2n) / 10n;
    if (stakeWei < min || stakeWei > max) { setTxError(`Stake must be ${fmtEth(min)}–${fmtEth(max)} ETH`); return; }
    setTakingId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Taking bounty", () => takeBounty(Number(bountyId), stakeEth), async () => {
      await loadBounties();
      await loadMyBounties();
      setSelectedId(null);
      await fireAudit(repoId, "take_bounty", { bountyId: bountyId.toString(), stakeEth });
    });
    setTakingId(null);
  }

  async function handleSubmitPR(bountyId: bigint) {
    const url = prInputs[bountyId.toString()] || "";
    if (!url.startsWith("https://github.com/")) { setTxError("Enter a valid GitHub PR URL"); return; }
    setSubmittingPRId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Submitting PR", () => submitPR(Number(bountyId), url), async () => {
      await loadMyBounties();
      await loadBounties();
      await fireAudit(repoId, "submit_pr", { bountyId: bountyId.toString(), prUrl: url });
    });
    setSubmittingPRId(null);
  }

  async function handleClaimBounty(bountyId: bigint) {
    setClaimingId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Claiming bounty", () => claimBounty(Number(bountyId)), async () => {
      await loadMyBounties();
      await loadBounties();
      await fireAudit(repoId, "claim_bounty", { bountyId: bountyId.toString() });
    });
    setClaimingId(null);
  }

  async function handleClaimExpired(bountyId: bigint) {
    setClaimExpiredId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Claiming expired bounty", () => claimExpiredBounty(Number(bountyId)), async () => {
      await loadMyBounties();
      await loadBounties();
      await fireAudit(repoId, "claim_expired_bounty", { bountyId: bountyId.toString() });
    });
    setClaimExpiredId(null);
  }

  // ── Org handlers ─────────────────────────────────────────────────────────────
  async function handleApproveMerge(bounty: OnChainBounty) {
    if (!bounty.prUrl) { setTxError("Missing PR URL for merge"); return; }
    setApprovingId(bounty.id);
    setTxError(""); setTxStatus("Checking PR status...");
    const repoId = resolveRepoIdForBounty(bounty.id);
    const mergeMethod = "merge";
    let alreadyMerged = false;
    try {
      const statusRes = await fetch(`/api/github/pr-status?prUrl=${encodeURIComponent(bounty.prUrl)}`);
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData?.merged) {
        alreadyMerged = true;
      }
      if (!alreadyMerged) {
        setTxStatus("Merging PR on GitHub...");
        const res = await fetch("/api/github/merge-pr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prUrl: bounty.prUrl, mergeMethod }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data?.error || "Failed to merge PR";
          setTxError(msg);
          setTxStatus("");
          setApprovingId(null);
          return;
        }
        if (!data?.merged) {
          const msg = data?.message || "PR merge was not completed";
          // If already merged outside, still allow approve
          if (!/already merged/i.test(msg)) {
            setTxError(msg);
            setTxStatus("");
            setApprovingId(null);
            return;
          }
          alreadyMerged = true;
        }
      }
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Failed to merge PR");
      setTxStatus("");
      setApprovingId(null);
      return;
    }

    await runTx("Approving merge", () => approveMerge(Number(bounty.id)), async () => {
      await loadBounties();
      await loadOrgData();
      await fireAudit(repoId, "merge_and_approve", {
        bountyId: bounty.id.toString(),
        prUrl: bounty.prUrl,
        mergeMethod,
        alreadyMerged,
      });
    });
    setApprovingId(null);
  }

  async function handleRejectPR(bountyId: bigint) {
    setRejectingId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Rejecting PR", () => rejectPR(Number(bountyId)), async () => {
      await loadBounties();
      await loadOrgData();
      await fireAudit(repoId, "reject_pr", { bountyId: bountyId.toString() });
    });
    setRejectingId(null);
  }

  async function handleCancelBounty(bountyId: bigint) {
    if (!confirm("Cancel this bounty? Remaining funds return to the repo pool.")) return;
    setCancellingId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Cancelling bounty", () => cancelBounty(Number(bountyId)), async () => {
      await loadBounties();
      await loadOrgData();
      await fireAudit(repoId, "cancel_bounty", { bountyId: bountyId.toString() });
    });
    setCancellingId(null);
  }

  async function handleIncreaseBounty(bountyId: bigint) {
    const amt = increaseAmounts[bountyId.toString()] || "";
    if (!amt || parseFloat(amt) <= 0) { setTxError("Enter amount to add"); return; }
    setIncreasingId(bountyId);
    const repoId = resolveRepoIdForBounty(bountyId);
    await runTx("Increasing bounty", () => increaseBounty(Number(bountyId), amt), async () => {
      await loadBounties();
      await loadOrgData();
      await fireAudit(repoId, "increase_bounty", { bountyId: bountyId.toString(), amountEth: amt });
    });
    setIncreasingId(null);
  }

  async function handleFundRepo(repoId: bigint) {
    const amt = fundAmounts[repoId.toString()] || "";
    if (!amt || parseFloat(amt) <= 0) { setTxError("Enter amount to fund"); return; }
    setFundingRepoId(repoId);
    await runTx("Funding repo", () => fundRepo(Number(repoId), amt), async () => {
      await loadOrgData();
      await fireAudit(repoId, "fund_repo", { amountEth: amt });
    });
    setFundingRepoId(null);
  }

  async function handleWithdrawRepoFunds(repoId: bigint) {
    const amt = withdrawAmounts[repoId.toString()] || "";
    if (!amt || parseFloat(amt) <= 0) { setTxError("Enter amount to withdraw"); return; }
    setWithdrawingRepoId(repoId);
    await runTx("Withdrawing funds", () => withdrawRepoFunds(Number(repoId), amt), async () => {
      await loadOrgData();
      await fireAudit(repoId, "withdraw_repo_funds", { amountEth: amt });
    });
    setWithdrawingRepoId(null);
  }


  // ── Nav ─────────────────────────────────────────────────────────────────────
  const NAV_ITEMS: { id: DashboardTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "repos", label: "Add Repo", icon: Database },
    { id: "bounties", label: "Bounties", icon: GitBranch, count: openCount },
    { id: "my-issues", label: "My Issues", icon: GitPullRequest },
    { id: "org", label: "Org Panel", icon: Building2, count: orgRepos.length || undefined },
  ];

  const toggleAnalysis = (repo: OnChainRepo) => {
    if (analysisRepoId === repo.id) {
      setAnalysisRepoId(null);
      setAnalysisRepoUrl(null);
    } else {
      setAnalysisRepoId(repo.id);
      setAnalysisRepoUrl(repo.repoUrl || "");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background bg-dot-grid">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1.5 font-mono text-sm font-bold uppercase text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:block">Home</span>
            </Link>
            <div className="h-5 w-0.5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center border-2 border-border bg-neon-green">
                <Shield className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-extrabold uppercase">
                merge<span className="text-neon-green">X</span>
              </span>
              <span className="font-mono text-sm text-muted-foreground">/ Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/audit" className="brutal-btn hidden sm:flex items-center gap-1.5 border-neon-cyan bg-neon-cyan/10 px-3 py-1 font-mono text-sm font-bold text-neon-cyan hover:bg-neon-cyan/20">
              AI AUDIT
            </Link>
            <Link to="/add-repo" className="brutal-btn hidden sm:flex items-center gap-1.5 border-border bg-card px-3 py-1 font-mono text-sm text-foreground hover:border-neon-green">
              <Plus className="h-3.5 w-3.5" /> NEW REPO
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Tx status bar */}
      {(txStatus || txError) && (
        <div className={`border-b-2 px-4 py-2 font-mono text-sm font-bold flex items-center justify-between ${txError ? "border-neon-red bg-neon-red/10 text-neon-red" : "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"}`}>
          <span>{txError || txStatus}</span>
          {txError && <button onClick={() => setTxError("")} className="ml-4 underline text-xs">dismiss</button>}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-0 md:flex-row">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r-2 border-border bg-sidebar md:flex md:flex-col">
          <div className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`flex items-center justify-between px-3 py-2.5 text-left font-mono text-sm font-bold uppercase tracking-wider transition-colors ${
                  activeTab === item.id ? "border-2 border-neon-green bg-neon-green/10 text-neon-green" : "border-2 border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:border-border"
                }`}>
                <div className="flex items-center gap-2.5"><item.icon className="h-4 w-4" /><span>{item.label}</span></div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="border-2 border-neon-green bg-neon-green px-1.5 py-0.5 font-mono text-sm text-primary-foreground">{item.count}</span>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <Link to="/audit"
              className="flex items-center gap-2.5 border-2 border-transparent px-3 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-neon-cyan transition-colors hover:bg-sidebar-accent hover:border-border">
              <Shield className="h-4 w-4" />
              <span>AI Audit</span>
            </Link>
          </div>
          <div className="mt-auto border-t-2 border-border p-3 space-y-2.5">
            {[{ label: "World Chain", dot: "status-dot-green" }, { label: "NEAR AI", dot: "status-dot-cyan" }, { label: "Filecoin", dot: "status-dot-green" }].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`status-dot ${s.dot}`} />
                <span className="font-mono text-sm font-bold uppercase text-sidebar-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {/* Mobile tab bar */}
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`shrink-0 border-2 px-3 py-1.5 font-mono text-sm font-bold uppercase transition-colors ${activeTab === item.id ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground"}`}>
                {item.label}
              </button>
            ))}
            <Link to="/audit"
              className="shrink-0 border-2 border-neon-cyan bg-neon-cyan/10 px-3 py-1.5 font-mono text-sm font-bold uppercase text-neon-cyan">
              AI Audit
            </Link>
          </div>

          {/* Stats Row */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Open Bounties", value: openCount, icon: GitBranch, color: "green" },
              { label: "My Active", value: myBounties.filter((b) => b.status === 1 || b.status === 2).length, icon: GitPullRequest, color: "cyan" },
              { label: "My Repos", value: orgRepos.length, icon: Building2, color: "green" },
              { label: "Human Ratio", value: "100%", icon: Users, color: "green" },
            ].map((s) => (
              <div key={s.label} className="brutal-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className={`flex h-7 w-7 items-center justify-center border-2 border-border ${s.color === "cyan" ? "bg-neon-cyan" : "bg-neon-green"}`}>
                    <s.icon className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <span className={`status-dot ${s.color === "cyan" ? "status-dot-cyan" : "status-dot-green"}`} />
                </div>
                <div className={`font-mono text-2xl font-bold ${s.color === "cyan" ? "text-neon-cyan" : "text-neon-green"}`}>{s.value}</div>
                <div className="mt-0.5 font-mono text-sm uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── ADD REPO TAB ── */}
          {activeTab === "repos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Repository Intake</h2>
                <span className="border-2 border-neon-cyan bg-neon-cyan/10 px-2.5 py-1 font-mono text-sm font-bold text-neon-cyan">LAUNCH FLOW</span>
              </div>
              <div className="brutal-card p-4 md:p-6"><AddRepoContent embedded /></div>
            </div>
          )}

          {/* ── BOUNTIES TAB ── */}
          {activeTab === "bounties" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Bounties</h2>
                <div className="flex items-center gap-3">
                  <button onClick={loadBounties} disabled={loadingBounties} className="flex items-center gap-1.5 font-mono text-sm font-bold uppercase text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingBounties ? "animate-spin" : ""}`} /> Refresh
                  </button>
                  <div className="flex items-center gap-2"><span className="status-dot status-dot-green" /><span className="font-mono text-sm font-bold text-neon-green">{openCount} OPEN</span></div>
                </div>
              </div>

              {loadingBounties && (
                <div className="flex items-center gap-2 py-8 justify-center font-mono text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading on-chain bounties...
                </div>
              )}

              {!loadingBounties && bounties.length === 0 && (
                <div className="brutal-card p-8 text-center">
                  <GitBranch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-display text-base font-extrabold uppercase text-muted-foreground">No bounties yet</div>
                  <div className="mt-1 font-mono text-sm text-muted-foreground">Register a repo and create bounties to get started</div>
                  <Link to="/add-repo" className="brutal-btn mt-4 inline-flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-sm font-bold text-primary-foreground">
                    <Plus className="h-3.5 w-3.5" /> Add Repo
                  </Link>
                </div>
              )}

              {bounties.map((b) => {
                const sev = formatSev(b.severity);
                const status = formatStatus(b.status);
                const isOpen = b.status === 0;
                const isAssigned = b.status === 1;
                const isPRSubmitted = b.status === 2;
                const isMerged = b.status === 3;
                const isExpanded = selectedId === b.id;
                const key = b.id.toString();
                const isOwner = !!address && b.org.toLowerCase() === address.toLowerCase();
                const isAssignee = !!address && b.assignedTo.toLowerCase() === address.toLowerCase();

                return (
                  <div key={key} className={`brutal-card transition-all ${isExpanded ? "!border-neon-green !shadow-brutal-green" : ""}`}>
                    <div role="button" tabIndex={0} onClick={() => setSelectedId(isExpanded ? null : b.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(isExpanded ? null : b.id); } }}
                      className="w-full text-left">
                      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-muted-foreground">#{key}</span>
                            <span className={`border-2 px-1.5 py-0.5 font-mono text-sm font-bold uppercase ${SEV_STYLE[sev]}`}>{sev}</span>
                            <span className={`font-mono text-sm font-bold uppercase ${STATUS_STYLE[status]}`}>{status}</span>
                            {isMerged && isAssignee && (
                              <span className="border-2 border-neon-green bg-neon-green/10 px-1.5 py-0.5 font-mono text-sm font-bold uppercase text-neon-green">READY TO CLAIM</span>
                            )}
                          </div>
                          <div className="mb-1 truncate font-mono text-sm font-bold">{b.title || "(Untitled)"}</div>
                          <div className="font-mono text-sm text-muted-foreground truncate">{b.githubIssueUrl} · {b.createdAt > 0n ? timeSince(b.createdAt) : "just now"}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-sm font-bold text-neon-green">{fmtEth(b.amount)} ETH</div>
                            {isAssigned && b.deadline > 0n && (() => {
                              const { label, expired } = deadlineLabel(b.deadline);
                              return <div className={`font-mono text-sm flex items-center gap-1 justify-end ${expired ? "text-neon-red" : "text-neon-amber"}`}><Clock className="h-3 w-3" />{label}</div>;
                            })()}
                          </div>
                          {isOpen && !isOwner && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
                              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-3 py-1.5 font-mono text-sm font-bold text-primary-foreground">
                              <Lock className="h-3 w-3" /> APPLY
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t-2 border-border p-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <div className="mb-1 font-mono text-sm uppercase text-muted-foreground">Org</div>
                            <div className="font-mono text-sm font-bold break-all">{b.org}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-mono text-sm uppercase text-muted-foreground">Assigned To</div>
                            <div className="font-mono text-sm font-bold">{b.assignedTo === ethers.ZeroAddress ? "—" : `${b.assignedTo.slice(0,8)}…${b.assignedTo.slice(-4)}`}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-mono text-sm uppercase text-muted-foreground">PR URL</div>
                            {b.prUrl ? (
                              <a href={b.prUrl} target="_blank" rel="noreferrer" className="font-mono text-sm font-bold text-neon-cyan hover:underline flex items-center gap-1">View PR <ExternalLink className="h-3 w-3" /></a>
                            ) : <span className="font-mono text-sm text-muted-foreground">None yet</span>}
                          </div>
                        </div>

                        {b.description && <div className="border-2 border-border bg-surface-2 p-3 font-mono text-sm text-muted-foreground">{b.description}</div>}

                        {/* Contributor: take bounty */}
                        {isOpen && isConnected && !isOwner && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input type="number" placeholder={`Stake ETH (${fmtEth(b.amount / 10n)}–${fmtEth((b.amount * 2n) / 10n)})`}
                              value={stakeInputs[key] ?? ""} onChange={(e) => setStakeInputs((p) => ({ ...p, [key]: e.target.value }))}
                              className="flex-1 border-2 border-border bg-background px-3 py-1.5 font-mono text-sm focus:border-neon-green focus:outline-none" />
                            <button onClick={() => handleTakeBounty(b.id, b.amount)} disabled={takingId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                              {takingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} APPLY FOR BOUNTY
                            </button>
                          </div>
                        )}
                        {isOpen && isConnected && !isOwner && (
                          <div className="flex flex-wrap gap-2">
                            {[10, 15, 20].map((pct) => (
                              <button
                                key={pct}
                                onClick={() => setStakeInputs((p) => ({ ...p, [key]: stakeForPercent(b.amount, pct) }))}
                                className="border-2 border-border bg-background px-2 py-1 font-mono text-xs font-bold text-muted-foreground hover:border-neon-green hover:text-neon-green"
                              >
                                {pct}% ({stakeForPercent(b.amount, pct)} ETH)
                              </button>
                            ))}
                          </div>
                        )}
                        {isOpen && !isConnected && (
                          <div className="flex items-center gap-3 border-2 border-neon-amber bg-neon-amber/10 p-3">
                            <AlertTriangle className="h-4 w-4 text-neon-amber shrink-0" />
                            <span className="font-mono text-sm font-bold text-neon-amber">Connect wallet to take this bounty</span>
                            <WalletButton />
                          </div>
                        )}
                        {isOpen && isOwner && (
                          <div className="flex items-center gap-2 border-2 border-border bg-surface-2 px-3 py-2 font-mono text-sm font-bold text-muted-foreground">
                            <Shield className="h-3.5 w-3.5" /> You are the org — use a different wallet to take this bounty
                          </div>
                        )}

                        {/* Org: approve/reject PR */}
                        {isPRSubmitted && isOwner && (
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleApproveMerge(b)} disabled={approvingId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                              {approvingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} APPROVE (MERGE IF NEEDED)
                            </button>
                            <button onClick={() => handleRejectPR(b.id)} disabled={rejectingId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-red bg-neon-red/10 px-4 py-2 font-mono text-sm font-bold text-neon-red disabled:opacity-60">
                              {rejectingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} REJECT PR
                            </button>
                          </div>
                        )}

                        {/* Contributor: claim after merge */}
                        {isMerged && isAssignee && (
                          <button onClick={() => handleClaimBounty(b.id)} disabled={claimingId === b.id}
                            className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                            {claimingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} CLAIM {fmtEth(b.amount)} ETH
                          </button>
                        )}

                        <a href={b.githubIssueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm font-bold text-neon-cyan hover:underline">
                          View Issue <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MY ISSUES TAB ── */}
          {activeTab === "my-issues" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">My Issues</h2>
                {isConnected && <button onClick={loadMyBounties} className="flex items-center gap-1.5 font-mono text-sm font-bold uppercase text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>}
              </div>

              {!isConnected && (
                <div className="brutal-card p-8 text-center">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-neon-amber" />
                  <div className="font-display text-base font-extrabold uppercase">Wallet Not Connected</div>
                  <div className="mt-2 mb-4 font-mono text-sm text-muted-foreground">Connect your wallet to see your assigned bounties</div>
                  <WalletButton />
                </div>
              )}

              {isConnected && myBounties.length === 0 && (
                <div className="brutal-card p-8 text-center">
                  <GitPullRequest className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-display text-base font-extrabold uppercase text-muted-foreground">No Active Issues</div>
                  <div className="mt-1 font-mono text-sm text-muted-foreground">Take a bounty from the Bounties tab to get started</div>
                </div>
              )}

              {isConnected && myBounties.map((b) => {
                const status = formatStatus(b.status);
                const sev = formatSev(b.severity);
                const key = b.id.toString();
                const isAssigned = b.status === 1;
                const isPRSubmitted = b.status === 2;
                const isMerged = b.status === 3;
                const isCompleted = b.status === 4;
                const { label: dlLabel, expired: dlExpired } = b.deadline > 0n ? deadlineLabel(b.deadline) : { label: "", expired: false };

                return (
                  <div key={key} className="brutal-card p-4 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-muted-foreground">#{key}</span>
                          <span className={`border-2 px-1.5 py-0.5 font-mono text-sm font-bold uppercase ${SEV_STYLE[sev]}`}>{sev}</span>
                          <span className={`font-mono text-sm font-bold uppercase ${STATUS_STYLE[status]}`}>{status}</span>
                        </div>
                        <div className="font-mono text-sm font-bold">{b.title || "(Untitled)"}</div>
                        <a href={b.githubIssueUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-neon-cyan hover:underline flex items-center gap-1 mt-1">
                          {b.githubIssueUrl} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-sm font-bold text-neon-green">{fmtEth(b.amount)} ETH</div>
                        <div className="font-mono text-sm text-muted-foreground">Stake: {fmtEth(b.contributorStake)} ETH</div>
                        {isAssigned && b.deadline > 0n && (
                          <div className={`font-mono text-sm flex items-center gap-1 justify-end mt-1 ${dlExpired ? "text-neon-red" : "text-neon-amber"}`}>
                            <Clock className="h-3 w-3" />{dlLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ASSIGNED — PR URL form */}
                    {isAssigned && (
                      <div className="border-2 border-neon-cyan bg-neon-cyan/5 p-3 space-y-3">
                        <div className="font-mono text-sm font-bold uppercase text-neon-cyan">Step: Submit Your PR</div>
                        <div className="font-mono text-sm text-muted-foreground">Open your PR on GitHub, paste the URL here to record it on-chain before the deadline.</div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input type="url" placeholder="https://github.com/owner/repo/pull/123"
                            value={prInputs[key] ?? ""} onChange={(e) => setPrInputs((p) => ({ ...p, [key]: e.target.value }))}
                            className="flex-1 border-2 border-border bg-background px-3 py-1.5 font-mono text-sm focus:border-neon-cyan focus:outline-none" />
                          <button onClick={() => handleSubmitPR(b.id)} disabled={submittingPRId === b.id}
                            className="brutal-btn flex items-center gap-1.5 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                            {submittingPRId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />} SUBMIT PR
                          </button>
                        </div>
                        {dlExpired && (
                          <div className="border-t-2 border-neon-red/30 pt-2">
                            <div className="font-mono text-sm text-neon-red mb-2">Deadline passed — you can claim expired bounty (50% stake returned)</div>
                            <button onClick={() => handleClaimExpired(b.id)} disabled={claimExpiredId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-red bg-neon-red/10 px-3 py-1.5 font-mono text-sm font-bold text-neon-red disabled:opacity-60">
                              {claimExpiredId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} CLAIM EXPIRED
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PR_SUBMITTED — waiting for org */}
                    {isPRSubmitted && (
                      <div className="border-2 border-neon-amber bg-neon-amber/5 p-3 space-y-3">
                        <div className="font-mono text-sm font-bold uppercase text-neon-amber">PR Under Review</div>
                        <a href={b.prUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-neon-cyan hover:underline flex items-center gap-1">
                          {b.prUrl} <ExternalLink className="h-3 w-3" />
                        </a>
                        <div className="font-mono text-sm text-muted-foreground">
                          Submitted {b.prSubmittedAt > 0n ? timeSince(b.prSubmittedAt) : ""} — waiting for org to approve
                        </div>
                        <PRAnalysisPanel prUrl={b.prUrl} issueUrl={b.githubIssueUrl} issueTitle={b.title} issueDescription={b.description} />
                      </div>
                    )}

                    {/* MERGED — claim */}
                    {isMerged && (
                      <div className="border-2 border-neon-green bg-neon-green/5 p-3 space-y-3">
                        <div className="font-mono text-sm font-bold uppercase text-neon-green">Merge Approved — Claim Your Reward!</div>
                        <button onClick={() => handleClaimBounty(b.id)} disabled={claimingId === b.id}
                          className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                          {claimingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          CLAIM {fmtEth(b.amount + b.contributorStake)} ETH
                        </button>
                      </div>
                    )}

                    {/* COMPLETED */}
                    {isCompleted && (
                      <div className="border-2 border-border bg-surface-2 p-3 flex items-center gap-2 font-mono text-sm font-bold text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-neon-green" /> Completed — {fmtEth(b.amount + b.contributorStake)} ETH claimed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ORG PANEL TAB ── */}
          {activeTab === "org" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Org Panel</h2>
                {isConnected && (
                  <button onClick={loadOrgData} disabled={loadingOrg} className="flex items-center gap-1.5 font-mono text-sm font-bold uppercase text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingOrg ? "animate-spin" : ""}`} /> Refresh
                  </button>
                )}
              </div>

              {!isConnected && (
                <div className="brutal-card p-8 text-center">
                  <Building2 className="mx-auto mb-3 h-8 w-8 text-neon-amber" />
                  <div className="font-display text-base font-extrabold uppercase">Wallet Not Connected</div>
                  <div className="mt-2 mb-4 font-mono text-sm text-muted-foreground">Connect your wallet to manage your repos and bounties</div>
                  <WalletButton />
                </div>
              )}

              {isConnected && loadingOrg && (
                <div className="flex items-center gap-2 py-8 justify-center font-mono text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your repos...
                </div>
              )}

              {isConnected && !loadingOrg && orgRepos.length === 0 && (
                <div className="brutal-card p-8 text-center">
                  <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-display text-base font-extrabold uppercase text-muted-foreground">No Repos Registered</div>
                  <div className="mt-1 font-mono text-sm text-muted-foreground">Register a repo to start creating bounties</div>
                  <button onClick={() => setTab("repos")} className="brutal-btn mt-4 inline-flex items-center gap-1.5 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-sm font-bold text-primary-foreground">
                    <Plus className="h-3.5 w-3.5" /> Add Repo
                  </button>
                </div>
              )}

              {isConnected && orgRepos.map((repo) => {
                const repoKey = repo.id.toString();
                const repoBounties = orgBounties[repoKey] ?? [];
                const isExpanded = expandedRepo === repo.id;
                const pendingPRs = repoBounties.filter((b) => b.status === 2).length;
                const assignedCount = repoBounties.filter((b) => b.status === 1).length;

                return (
                  <div key={repoKey} className={`brutal-card transition-all ${isExpanded ? "!border-neon-cyan" : ""}`}>
                    {/* Repo Header */}
                    <div role="button" tabIndex={0}
                      onClick={() => setExpandedRepo(isExpanded ? null : repo.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedRepo(isExpanded ? null : repo.id); } }}
                      className="flex flex-col gap-3 p-4 md:flex-row md:items-center cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-muted-foreground">REPO #{repoKey}</span>
                          {pendingPRs > 0 && (
                            <span className="border-2 border-neon-amber bg-neon-amber/10 px-1.5 py-0.5 font-mono text-sm font-bold text-neon-amber">{pendingPRs} PR{pendingPRs > 1 ? "s" : ""} TO REVIEW</span>
                          )}
                          {assignedCount > 0 && (
                            <span className="border-2 border-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 font-mono text-sm font-bold text-neon-cyan">{assignedCount} ASSIGNED</span>
                          )}
                          {!repo.isActive && <span className="border-2 border-neon-red bg-neon-red/10 px-1.5 py-0.5 font-mono text-sm font-bold text-neon-red">INACTIVE</span>}
                        </div>
                        <div className="font-display text-xl font-extrabold uppercase truncate">{repo.repoUrl}</div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-base font-bold text-neon-green">{fmtEth(repo.available)} ETH available</div>
                          <div className="font-mono text-sm text-muted-foreground">{fmtEth(repo.totalFunded)} ETH total funded</div>
                        </div>
                        <div className="font-mono text-sm text-muted-foreground">{repoBounties.length} bounties</div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-neon-cyan" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Repo Expanded */}
                    {isExpanded && (
                      <div className="border-t-2 border-border space-y-0">
                        {/* Repo analysis */}
                        <div className="p-4 border-b-2 border-border">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-mono text-sm font-bold uppercase text-muted-foreground">// repo analysis</div>
                            <button
                              onClick={() => toggleAnalysis(repo)}
                              className="brutal-btn inline-flex items-center gap-2 border-neon-cyan bg-neon-cyan/10 px-3 py-2 font-mono text-sm font-bold text-neon-cyan"
                            >
                              {analysisRepoId === repo.id ? "Hide" : "ADD BOUNTY"}
                            </button>
                          </div>
                          {analysisRepoId === repo.id && (
                            <div className="mt-4">
                              <AddRepoContent
                                key={repo.id.toString()}
                                embedded
                                initialRepoUrl={analysisRepoUrl || repo.repoUrl}
                                autoFetch
                                hideRepoInput
                              />
                            </div>
                          )}
                        </div>

                        {/* Repo actions: Fund + Withdraw */}
                        <div className="grid gap-0 md:grid-cols-2 border-b-2 border-border">
                          <div className="p-4 border-b-2 md:border-b-0 md:border-r-2 border-border space-y-2">
                            <div className="font-mono text-sm font-bold uppercase text-neon-green flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Fund Repo</div>
                            <div className="font-mono text-sm text-muted-foreground">Add ETH to the repo pool to fund new or existing bounties</div>
                            <div className="flex gap-2">
                              <input type="number" placeholder="ETH amount" value={fundAmounts[repoKey] ?? ""}
                                onChange={(e) => setFundAmounts((p) => ({ ...p, [repoKey]: e.target.value }))}
                                className="flex-1 border-2 border-border bg-background px-3 py-2 font-mono text-sm focus:border-neon-green focus:outline-none" />
                              <button onClick={() => handleFundRepo(repo.id)} disabled={fundingRepoId === repo.id}
                                className="brutal-btn flex items-center gap-1 border-neon-green bg-neon-green px-3 py-2 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                                {fundingRepoId === repo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} FUND
                              </button>
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="font-mono text-sm font-bold uppercase text-neon-amber flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Withdraw Funds</div>
                            <div className="font-mono text-sm text-muted-foreground">Withdraw available ETH (not locked in active bounties)</div>
                            <div className="flex gap-2">
                              <input type="number" placeholder={`Max ${fmtEth(repo.available)} ETH`} value={withdrawAmounts[repoKey] ?? ""}
                                onChange={(e) => setWithdrawAmounts((p) => ({ ...p, [repoKey]: e.target.value }))}
                                className="flex-1 border-2 border-border bg-background px-3 py-2 font-mono text-sm focus:border-neon-amber focus:outline-none" />
                              <button onClick={() => handleWithdrawRepoFunds(repo.id)} disabled={withdrawingRepoId === repo.id}
                                className="brutal-btn flex items-center gap-1 border-neon-amber bg-neon-amber/10 px-3 py-2 font-mono text-sm font-bold text-neon-amber disabled:opacity-60">
                                {withdrawingRepoId === repo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />} WITHDRAW
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Repo bounties list */}
                        <div className="p-4 space-y-3">
                          <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">// bounties in this repo</div>

                          {repoBounties.length === 0 && (
                            <div className="font-mono text-sm text-muted-foreground py-2">No bounties yet — go to Add Repo tab to create some</div>
                          )}

                          {repoBounties.map((b) => {
                            const bKey = b.id.toString();
                            const bSev = formatSev(b.severity);
                            const bStatus = formatStatus(b.status);
                            const bIsOpen = b.status === 0;
                            const bIsPRSubmitted = b.status === 2;
                            const bIsAssigned = b.status === 1;
                            const { label: dlLabel, expired: dlExpired } = b.deadline > 0n ? deadlineLabel(b.deadline) : { label: "", expired: false };

                            return (
                              <div key={bKey} className="border-2 border-border bg-surface-2 p-3 space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm text-muted-foreground">#{bKey}</span>
                                    <span className={`border-2 px-1.5 py-0.5 font-mono text-sm font-bold uppercase ${SEV_STYLE[bSev]}`}>{bSev}</span>
                                    <span className={`font-mono text-sm font-bold uppercase ${STATUS_STYLE[bStatus]}`}>{bStatus}</span>
                                    {bIsAssigned && b.deadline > 0n && (
                                      <span className={`font-mono text-sm font-bold ${dlExpired ? "text-neon-red" : "text-neon-amber"}`}><Clock className="h-3 w-3 inline mr-0.5" />{dlLabel}</span>
                                    )}
                                  </div>
                                  <div className="font-mono text-sm font-bold text-neon-green shrink-0">{fmtEth(b.amount)} ETH</div>
                                </div>
                                <div className="font-mono text-base font-bold">{b.title || "(Untitled)"}</div>
                                {bIsAssigned && (
                                  <div className="font-mono text-sm text-muted-foreground">Assigned to: {b.assignedTo.slice(0,8)}…{b.assignedTo.slice(-4)}</div>
                                )}
                                {b.prUrl && (
                                  <a href={b.prUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-neon-cyan hover:underline flex items-center gap-1">
                                    PR: {b.prUrl} <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}

                                {/* Org actions per status */}
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {/* Increase bounty (OPEN or ASSIGNED) */}
                                  {(bIsOpen || bIsAssigned) && (
                                    <div className="flex gap-1.5 items-center">
                                      <input type="number" placeholder="Add ETH" value={increaseAmounts[bKey] ?? ""}
                                        onChange={(e) => setIncreaseAmounts((p) => ({ ...p, [bKey]: e.target.value }))}
                                        className="w-24 border-2 border-border bg-background px-2 py-1 font-mono text-sm focus:border-neon-green focus:outline-none" />
                                      <button onClick={() => handleIncreaseBounty(b.id)} disabled={increasingId === b.id}
                                        className="brutal-btn flex items-center gap-1 border-neon-green bg-neon-green/10 px-2 py-1 font-mono text-sm font-bold text-neon-green disabled:opacity-60">
                                        {increasingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />} INCREASE
                                      </button>
                                    </div>
                                  )}

                                  {/* Cancel (OPEN only) */}
                                  {bIsOpen && (
                                    <button onClick={() => handleCancelBounty(b.id)} disabled={cancellingId === b.id}
                                      className="brutal-btn flex items-center gap-1 border-neon-red bg-neon-red/10 px-2 py-1 font-mono text-sm font-bold text-neon-red disabled:opacity-60">
                                      {cancellingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} CANCEL
                                    </button>
                                  )}

                                  {/* Approve / Reject PR */}
                                  {bIsPRSubmitted && (
                                    <>
                                      <button onClick={() => handleApproveMerge(b)} disabled={approvingId === b.id}
                                        className="brutal-btn flex items-center gap-1 border-neon-green bg-neon-green px-3 py-1 font-mono text-sm font-bold text-primary-foreground disabled:opacity-60">
                                        {approvingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} APPROVE (MERGE IF NEEDED)
                                      </button>
                                      <button onClick={() => handleRejectPR(b.id)} disabled={rejectingId === b.id}
                                        className="brutal-btn flex items-center gap-1 border-neon-red bg-neon-red/10 px-3 py-1 font-mono text-sm font-bold text-neon-red disabled:opacity-60">
                                        {rejectingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} REJECT
                                      </button>
                                    </>
                                  )}

                                  {b.prUrl && (
                                    <button onClick={() => toggleOrgReview(bKey)}
                                      className="brutal-btn flex items-center gap-1 border-neon-cyan bg-neon-cyan/10 px-3 py-1 font-mono text-sm font-bold text-neon-cyan">
                                      <Brain className="h-3 w-3" /> AI REVIEW
                                    </button>
                                  )}

                                  <a href={b.githubIssueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-neon-cyan hover:underline">
                                    Issue <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                                {b.prUrl && orgReviewOpen.has(bKey) && (
                                  <PRAnalysisPanel prUrl={b.prUrl} issueUrl={b.githubIssueUrl} issueTitle={b.title} issueDescription={b.description} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
