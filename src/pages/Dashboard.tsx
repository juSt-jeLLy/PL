import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Shield, GitBranch, Brain, HardDrive, Globe, Activity,
  CheckCircle, Clock, AlertTriangle, ArrowLeft, Plus,
  Users, Database, Zap, ExternalLink, RefreshCw,
  TrendingUp, Lock, GitPullRequest, Loader2, Building2,
  XCircle, DollarSign, Wallet, ChevronDown, ChevronRight,
} from "lucide-react";
import { ethers } from "ethers";
import { AddRepoContent } from "./AddRepo";
import WalletButton from "@/components/WalletButton";
import { useWallet } from "@/context/WalletContext";
import { useContract } from "@/hooks/useContract";
import { OnChainBounty, OnChainRepo, SEVERITY_FROM_NUM, STATUS_FROM_NUM } from "@/lib/contract";

// ─── Types ────────────────────────────────────────────────────────────────────
type DashboardTab = "repos" | "bounties" | "my-issues" | "org" | "agents" | "storage" | "identity";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtEth(wei: bigint): string {
  return parseFloat(ethers.formatEther(wei)).toFixed(4);
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

const AGENT_LOGS = [
  { id: "1", time: "14:32:01", message: "NEAR agent spawned for bounty — private inference mode ON", type: "info" as const },
  { id: "2", time: "14:32:04", message: "Loading repo context...", type: "info" as const },
  { id: "3", time: "14:32:18", message: "Static analysis complete: 3 potential issues flagged", type: "warn" as const },
  { id: "4", time: "14:32:21", message: "Pattern match: CEI violation detected in withdraw() line 147", type: "error" as const },
  { id: "5", time: "14:32:28", message: "Audit trail pinned to Filecoin via Synapse SDK", type: "success" as const },
  { id: "6", time: "14:32:29", message: "CID: bafybeih4x2q3kv8mza — immutable record created", type: "success" as const },
];
const LOG_STYLE = { info: "text-muted-foreground", success: "text-neon-green", warn: "text-neon-amber", error: "text-neon-red" };
const LOG_PREFIX = { info: "[INFO]", success: "[OK]  ", warn: "[WARN]", error: "[ERR] " };

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { address, isConnected } = useWallet();
  const {
    getAllBounties, getContributorBounties, getOrgRepos, getRepoBounties,
    takeBounty, submitPR, claimBounty, claimExpiredBounty,
    approveMerge, rejectPR, cancelBounty, increaseBounty, fundRepo, withdrawRepoFunds,
  } = useContract();

  const readTabFromQuery = (): DashboardTab => {
    const tab = searchParams.get("tab");
    if (["repos","bounties","my-issues","org","agents","storage","identity"].includes(tab ?? "")) return tab as DashboardTab;
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
    await runTx("Taking bounty", () => takeBounty(Number(bountyId), stakeEth), async () => { await loadBounties(); await loadMyBounties(); setSelectedId(null); });
    setTakingId(null);
  }

  async function handleSubmitPR(bountyId: bigint) {
    const url = prInputs[bountyId.toString()] || "";
    if (!url.startsWith("https://github.com/")) { setTxError("Enter a valid GitHub PR URL"); return; }
    setSubmittingPRId(bountyId);
    await runTx("Submitting PR", () => submitPR(Number(bountyId), url), async () => { await loadMyBounties(); await loadBounties(); });
    setSubmittingPRId(null);
  }

  async function handleClaimBounty(bountyId: bigint) {
    setClaimingId(bountyId);
    await runTx("Claiming bounty", () => claimBounty(Number(bountyId)), async () => { await loadMyBounties(); await loadBounties(); });
    setClaimingId(null);
  }

  async function handleClaimExpired(bountyId: bigint) {
    setClaimExpiredId(bountyId);
    await runTx("Claiming expired bounty", () => claimExpiredBounty(Number(bountyId)), async () => { await loadMyBounties(); await loadBounties(); });
    setClaimExpiredId(null);
  }

  // ── Org handlers ─────────────────────────────────────────────────────────────
  async function handleApproveMerge(bountyId: bigint) {
    setApprovingId(bountyId);
    await runTx("Approving merge", () => approveMerge(Number(bountyId)), async () => { await loadBounties(); await loadOrgData(); });
    setApprovingId(null);
  }

  async function handleRejectPR(bountyId: bigint) {
    setRejectingId(bountyId);
    await runTx("Rejecting PR", () => rejectPR(Number(bountyId)), async () => { await loadBounties(); await loadOrgData(); });
    setRejectingId(null);
  }

  async function handleCancelBounty(bountyId: bigint) {
    if (!confirm("Cancel this bounty? Remaining funds return to the repo pool.")) return;
    setCancellingId(bountyId);
    await runTx("Cancelling bounty", () => cancelBounty(Number(bountyId)), async () => { await loadBounties(); await loadOrgData(); });
    setCancellingId(null);
  }

  async function handleIncreaseBounty(bountyId: bigint) {
    const amt = increaseAmounts[bountyId.toString()] || "";
    if (!amt || parseFloat(amt) <= 0) { setTxError("Enter amount to add"); return; }
    setIncreasingId(bountyId);
    await runTx("Increasing bounty", () => increaseBounty(Number(bountyId), amt), async () => { await loadBounties(); await loadOrgData(); });
    setIncreasingId(null);
  }

  async function handleFundRepo(repoId: bigint) {
    const amt = fundAmounts[repoId.toString()] || "";
    if (!amt || parseFloat(amt) <= 0) { setTxError("Enter amount to fund"); return; }
    setFundingRepoId(repoId);
    await runTx("Funding repo", () => fundRepo(Number(repoId), amt), async () => { await loadOrgData(); });
    setFundingRepoId(null);
  }

  async function handleWithdrawRepoFunds(repoId: bigint) {
    const amt = withdrawAmounts[repoId.toString()] || "";
    if (!amt || parseFloat(amt) <= 0) { setTxError("Enter amount to withdraw"); return; }
    setWithdrawingRepoId(repoId);
    await runTx("Withdrawing funds", () => withdrawRepoFunds(Number(repoId), amt), async () => { await loadOrgData(); });
    setWithdrawingRepoId(null);
  }

  // ── Nav ─────────────────────────────────────────────────────────────────────
  const NAV_ITEMS: { id: DashboardTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "repos", label: "Add Repo", icon: Database },
    { id: "bounties", label: "Bounties", icon: GitBranch, count: openCount },
    { id: "my-issues", label: "My Issues", icon: GitPullRequest },
    { id: "org", label: "Org Panel", icon: Building2, count: orgRepos.length || undefined },
    { id: "agents", label: "NEAR Agents", icon: Brain },
    { id: "storage", label: "Filecoin Logs", icon: HardDrive },
    { id: "identity", label: "Identity", icon: Globe },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors">
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
              <span className="font-mono text-xs text-muted-foreground">/ Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/add-repo" className="brutal-btn hidden sm:flex items-center gap-1.5 border-border bg-card px-3 py-1 font-mono text-xs text-foreground hover:border-neon-green">
              <Plus className="h-3.5 w-3.5" /> NEW REPO
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Tx status bar */}
      {(txStatus || txError) && (
        <div className={`border-b-2 px-4 py-2 font-mono text-xs font-bold flex items-center justify-between ${txError ? "border-neon-red bg-neon-red/10 text-neon-red" : "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"}`}>
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
                  <span className="border-2 border-neon-green bg-neon-green px-1.5 py-0.5 font-mono text-xs text-primary-foreground">{item.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-auto border-t-2 border-border p-3 space-y-2.5">
            {[{ label: "World Chain", dot: "status-dot-green" }, { label: "NEAR AI", dot: "status-dot-cyan" }, { label: "Filecoin", dot: "status-dot-green" }].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`status-dot ${s.dot}`} />
                <span className="font-mono text-xs font-bold uppercase text-sidebar-foreground">{s.label}</span>
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
                className={`shrink-0 border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${activeTab === item.id ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground"}`}>
                {item.label}
              </button>
            ))}
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
                <div className="mt-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── ADD REPO TAB ── */}
          {activeTab === "repos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Repository Intake</h2>
                <span className="border-2 border-neon-cyan bg-neon-cyan/10 px-2.5 py-1 font-mono text-xs font-bold text-neon-cyan">LAUNCH FLOW</span>
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
                  <button onClick={loadBounties} disabled={loadingBounties} className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingBounties ? "animate-spin" : ""}`} /> Refresh
                  </button>
                  <div className="flex items-center gap-2"><span className="status-dot status-dot-green" /><span className="font-mono text-xs font-bold text-neon-green">{openCount} OPEN</span></div>
                </div>
              </div>

              {loadingBounties && (
                <div className="flex items-center gap-2 py-8 justify-center font-mono text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading on-chain bounties...
                </div>
              )}

              {!loadingBounties && bounties.length === 0 && (
                <div className="brutal-card p-8 text-center">
                  <GitBranch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-display text-base font-extrabold uppercase text-muted-foreground">No bounties yet</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">Register a repo and create bounties to get started</div>
                  <Link to="/add-repo" className="brutal-btn mt-4 inline-flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold text-primary-foreground">
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
                            <span className="font-mono text-xs font-bold text-muted-foreground">#{key}</span>
                            <span className={`border-2 px-1.5 py-0.5 font-mono text-xs font-bold uppercase ${SEV_STYLE[sev]}`}>{sev}</span>
                            <span className={`font-mono text-xs font-bold uppercase ${STATUS_STYLE[status]}`}>{status}</span>
                          </div>
                          <div className="mb-1 truncate font-display text-base font-extrabold uppercase">{b.title || "(Untitled)"}</div>
                          <div className="font-mono text-xs text-muted-foreground truncate">{b.githubIssueUrl} · {b.createdAt > 0n ? timeSince(b.createdAt) : "just now"}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-sm font-bold text-neon-green">{fmtEth(b.amount)} ETH</div>
                            {isAssigned && b.deadline > 0n && (() => {
                              const { label, expired } = deadlineLabel(b.deadline);
                              return <div className={`font-mono text-xs flex items-center gap-1 justify-end ${expired ? "text-neon-red" : "text-neon-amber"}`}><Clock className="h-3 w-3" />{label}</div>;
                            })()}
                          </div>
                          {isOpen && !isOwner && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
                              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-3 py-1.5 font-mono text-xs font-bold text-primary-foreground">
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
                            <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Org</div>
                            <div className="font-mono text-xs font-bold break-all">{b.org}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Assigned To</div>
                            <div className="font-mono text-xs font-bold">{b.assignedTo === ethers.ZeroAddress ? "—" : `${b.assignedTo.slice(0,8)}…${b.assignedTo.slice(-4)}`}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">PR URL</div>
                            {b.prUrl ? (
                              <a href={b.prUrl} target="_blank" rel="noreferrer" className="font-mono text-xs font-bold text-neon-cyan hover:underline flex items-center gap-1">View PR <ExternalLink className="h-3 w-3" /></a>
                            ) : <span className="font-mono text-xs text-muted-foreground">None yet</span>}
                          </div>
                        </div>

                        {b.description && <div className="border-2 border-border bg-surface-2 p-3 font-mono text-xs text-muted-foreground">{b.description}</div>}

                        {/* Contributor: take bounty */}
                        {isOpen && isConnected && !isOwner && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input type="number" placeholder={`Stake ETH (${fmtEth(b.amount / 10n)}–${fmtEth((b.amount * 2n) / 10n)})`}
                              value={stakeInputs[key] ?? ""} onChange={(e) => setStakeInputs((p) => ({ ...p, [key]: e.target.value }))}
                              className="flex-1 border-2 border-border bg-background px-3 py-1.5 font-mono text-xs focus:border-neon-green focus:outline-none" />
                            <button onClick={() => handleTakeBounty(b.id, b.amount)} disabled={takingId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                              {takingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} APPLY FOR BOUNTY
                            </button>
                          </div>
                        )}
                        {isOpen && !isConnected && (
                          <div className="flex items-center gap-3 border-2 border-neon-amber bg-neon-amber/10 p-3">
                            <AlertTriangle className="h-4 w-4 text-neon-amber shrink-0" />
                            <span className="font-mono text-xs font-bold text-neon-amber">Connect wallet to take this bounty</span>
                            <WalletButton />
                          </div>
                        )}
                        {isOpen && isOwner && (
                          <div className="flex items-center gap-2 border-2 border-border bg-surface-2 px-3 py-2 font-mono text-xs font-bold text-muted-foreground">
                            <Shield className="h-3.5 w-3.5" /> You are the org — use a different wallet to take this bounty
                          </div>
                        )}

                        {/* Org: approve/reject PR */}
                        {isPRSubmitted && isOwner && (
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleApproveMerge(b.id)} disabled={approvingId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                              {approvingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} APPROVE MERGE
                            </button>
                            <button onClick={() => handleRejectPR(b.id)} disabled={rejectingId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-red bg-neon-red/10 px-4 py-2 font-mono text-xs font-bold text-neon-red disabled:opacity-60">
                              {rejectingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} REJECT PR
                            </button>
                          </div>
                        )}

                        {/* Contributor: claim after merge */}
                        {isMerged && isAssignee && (
                          <button onClick={() => handleClaimBounty(b.id)} disabled={claimingId === b.id}
                            className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                            {claimingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} CLAIM {fmtEth(b.amount)} ETH
                          </button>
                        )}

                        <a href={b.githubIssueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs font-bold text-neon-cyan hover:underline">
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
                {isConnected && <button onClick={loadMyBounties} className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>}
              </div>

              {!isConnected && (
                <div className="brutal-card p-8 text-center">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-neon-amber" />
                  <div className="font-display text-base font-extrabold uppercase">Wallet Not Connected</div>
                  <div className="mt-2 mb-4 font-mono text-xs text-muted-foreground">Connect your wallet to see your assigned bounties</div>
                  <WalletButton />
                </div>
              )}

              {isConnected && myBounties.length === 0 && (
                <div className="brutal-card p-8 text-center">
                  <GitPullRequest className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-display text-base font-extrabold uppercase text-muted-foreground">No Active Issues</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">Take a bounty from the Bounties tab to get started</div>
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
                          <span className="font-mono text-xs font-bold text-muted-foreground">#{key}</span>
                          <span className={`border-2 px-1.5 py-0.5 font-mono text-xs font-bold uppercase ${SEV_STYLE[sev]}`}>{sev}</span>
                          <span className={`font-mono text-xs font-bold uppercase ${STATUS_STYLE[status]}`}>{status}</span>
                        </div>
                        <div className="font-display text-base font-extrabold uppercase">{b.title || "(Untitled)"}</div>
                        <a href={b.githubIssueUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-neon-cyan hover:underline flex items-center gap-1 mt-1">
                          {b.githubIssueUrl} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-sm font-bold text-neon-green">{fmtEth(b.amount)} ETH</div>
                        <div className="font-mono text-xs text-muted-foreground">Stake: {fmtEth(b.contributorStake)} ETH</div>
                        {isAssigned && b.deadline > 0n && (
                          <div className={`font-mono text-xs flex items-center gap-1 justify-end mt-1 ${dlExpired ? "text-neon-red" : "text-neon-amber"}`}>
                            <Clock className="h-3 w-3" />{dlLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ASSIGNED — PR URL form */}
                    {isAssigned && (
                      <div className="border-2 border-neon-cyan bg-neon-cyan/5 p-3 space-y-3">
                        <div className="font-mono text-xs font-bold uppercase text-neon-cyan">Step: Submit Your PR</div>
                        <div className="font-mono text-xs text-muted-foreground">Open your PR on GitHub, paste the URL here to record it on-chain before the deadline.</div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input type="url" placeholder="https://github.com/owner/repo/pull/123"
                            value={prInputs[key] ?? ""} onChange={(e) => setPrInputs((p) => ({ ...p, [key]: e.target.value }))}
                            className="flex-1 border-2 border-border bg-background px-3 py-1.5 font-mono text-xs focus:border-neon-cyan focus:outline-none" />
                          <button onClick={() => handleSubmitPR(b.id)} disabled={submittingPRId === b.id}
                            className="brutal-btn flex items-center gap-1.5 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                            {submittingPRId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />} SUBMIT PR
                          </button>
                        </div>
                        {dlExpired && (
                          <div className="border-t-2 border-neon-red/30 pt-2">
                            <div className="font-mono text-xs text-neon-red mb-2">Deadline passed — you can claim expired bounty (50% stake returned)</div>
                            <button onClick={() => handleClaimExpired(b.id)} disabled={claimExpiredId === b.id}
                              className="brutal-btn flex items-center gap-1.5 border-neon-red bg-neon-red/10 px-3 py-1.5 font-mono text-xs font-bold text-neon-red disabled:opacity-60">
                              {claimExpiredId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} CLAIM EXPIRED
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PR_SUBMITTED — waiting for org */}
                    {isPRSubmitted && (
                      <div className="border-2 border-neon-amber bg-neon-amber/5 p-3 space-y-2">
                        <div className="font-mono text-xs font-bold uppercase text-neon-amber">PR Under Review</div>
                        <a href={b.prUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-neon-cyan hover:underline flex items-center gap-1">
                          {b.prUrl} <ExternalLink className="h-3 w-3" />
                        </a>
                        <div className="font-mono text-xs text-muted-foreground">
                          Submitted {b.prSubmittedAt > 0n ? timeSince(b.prSubmittedAt) : ""} — waiting for org to approve
                        </div>
                      </div>
                    )}

                    {/* MERGED — claim */}
                    {isMerged && (
                      <div className="border-2 border-neon-green bg-neon-green/5 p-3 space-y-3">
                        <div className="font-mono text-xs font-bold uppercase text-neon-green">Merge Approved — Claim Your Reward!</div>
                        <button onClick={() => handleClaimBounty(b.id)} disabled={claimingId === b.id}
                          className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                          {claimingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          CLAIM {fmtEth(b.amount + b.contributorStake)} ETH
                        </button>
                      </div>
                    )}

                    {/* COMPLETED */}
                    {isCompleted && (
                      <div className="border-2 border-border bg-surface-2 p-3 flex items-center gap-2 font-mono text-xs font-bold text-muted-foreground">
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
                  <button onClick={loadOrgData} disabled={loadingOrg} className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingOrg ? "animate-spin" : ""}`} /> Refresh
                  </button>
                )}
              </div>

              {!isConnected && (
                <div className="brutal-card p-8 text-center">
                  <Building2 className="mx-auto mb-3 h-8 w-8 text-neon-amber" />
                  <div className="font-display text-base font-extrabold uppercase">Wallet Not Connected</div>
                  <div className="mt-2 mb-4 font-mono text-xs text-muted-foreground">Connect your wallet to manage your repos and bounties</div>
                  <WalletButton />
                </div>
              )}

              {isConnected && loadingOrg && (
                <div className="flex items-center gap-2 py-8 justify-center font-mono text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your repos...
                </div>
              )}

              {isConnected && !loadingOrg && orgRepos.length === 0 && (
                <div className="brutal-card p-8 text-center">
                  <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-display text-base font-extrabold uppercase text-muted-foreground">No Repos Registered</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">Register a repo to start creating bounties</div>
                  <button onClick={() => setTab("repos")} className="brutal-btn mt-4 inline-flex items-center gap-1.5 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-xs font-bold text-primary-foreground">
                    <Plus className="h-3.5 w-3.5" /> Add Repo
                  </button>
                </div>
              )}

              {isConnected && orgRepos.map((repo) => {
                const repoKey = repo.id.toString();
                const repoBounties = orgBounties[repoKey] ?? [];
                const isExpanded = expandedRepo === repo.id;
                const pendingPRs = repoBounties.filter((b) => b.status === 2).length;

                return (
                  <div key={repoKey} className={`brutal-card transition-all ${isExpanded ? "!border-neon-cyan" : ""}`}>
                    {/* Repo Header */}
                    <div role="button" tabIndex={0}
                      onClick={() => setExpandedRepo(isExpanded ? null : repo.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedRepo(isExpanded ? null : repo.id); } }}
                      className="flex flex-col gap-3 p-4 md:flex-row md:items-center cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-muted-foreground">REPO #{repoKey}</span>
                          {pendingPRs > 0 && (
                            <span className="border-2 border-neon-amber bg-neon-amber/10 px-1.5 py-0.5 font-mono text-xs font-bold text-neon-amber">{pendingPRs} PR{pendingPRs > 1 ? "s" : ""} TO REVIEW</span>
                          )}
                          {!repo.isActive && <span className="border-2 border-neon-red bg-neon-red/10 px-1.5 py-0.5 font-mono text-xs font-bold text-neon-red">INACTIVE</span>}
                        </div>
                        <div className="font-display text-base font-extrabold uppercase truncate">{repo.repoUrl}</div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-neon-green">{fmtEth(repo.available)} ETH available</div>
                          <div className="font-mono text-xs text-muted-foreground">{fmtEth(repo.totalFunded)} ETH total funded</div>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{repoBounties.length} bounties</div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-neon-cyan" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Repo Expanded */}
                    {isExpanded && (
                      <div className="border-t-2 border-border space-y-0">
                        {/* Repo actions: Fund + Withdraw */}
                        <div className="grid gap-0 md:grid-cols-2 border-b-2 border-border">
                          <div className="p-4 border-b-2 md:border-b-0 md:border-r-2 border-border space-y-2">
                            <div className="font-mono text-xs font-bold uppercase text-neon-green flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Fund Repo</div>
                            <div className="font-mono text-xs text-muted-foreground">Add ETH to the repo pool to fund new or existing bounties</div>
                            <div className="flex gap-2">
                              <input type="number" placeholder="ETH amount" value={fundAmounts[repoKey] ?? ""}
                                onChange={(e) => setFundAmounts((p) => ({ ...p, [repoKey]: e.target.value }))}
                                className="flex-1 border-2 border-border bg-background px-3 py-1.5 font-mono text-xs focus:border-neon-green focus:outline-none" />
                              <button onClick={() => handleFundRepo(repo.id)} disabled={fundingRepoId === repo.id}
                                className="brutal-btn flex items-center gap-1 border-neon-green bg-neon-green px-3 py-1.5 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                                {fundingRepoId === repo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} FUND
                              </button>
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="font-mono text-xs font-bold uppercase text-neon-amber flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Withdraw Funds</div>
                            <div className="font-mono text-xs text-muted-foreground">Withdraw available ETH (not locked in active bounties)</div>
                            <div className="flex gap-2">
                              <input type="number" placeholder={`Max ${fmtEth(repo.available)} ETH`} value={withdrawAmounts[repoKey] ?? ""}
                                onChange={(e) => setWithdrawAmounts((p) => ({ ...p, [repoKey]: e.target.value }))}
                                className="flex-1 border-2 border-border bg-background px-3 py-1.5 font-mono text-xs focus:border-neon-amber focus:outline-none" />
                              <button onClick={() => handleWithdrawRepoFunds(repo.id)} disabled={withdrawingRepoId === repo.id}
                                className="brutal-btn flex items-center gap-1 border-neon-amber bg-neon-amber/10 px-3 py-1.5 font-mono text-xs font-bold text-neon-amber disabled:opacity-60">
                                {withdrawingRepoId === repo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />} WITHDRAW
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Repo bounties list */}
                        <div className="p-4 space-y-3">
                          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">// bounties in this repo</div>

                          {repoBounties.length === 0 && (
                            <div className="font-mono text-xs text-muted-foreground py-2">No bounties yet — go to Add Repo tab to create some</div>
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
                                    <span className="font-mono text-xs text-muted-foreground">#{bKey}</span>
                                    <span className={`border-2 px-1.5 py-0.5 font-mono text-xs font-bold uppercase ${SEV_STYLE[bSev]}`}>{bSev}</span>
                                    <span className={`font-mono text-xs font-bold uppercase ${STATUS_STYLE[bStatus]}`}>{bStatus}</span>
                                    {bIsAssigned && b.deadline > 0n && (
                                      <span className={`font-mono text-xs font-bold ${dlExpired ? "text-neon-red" : "text-neon-amber"}`}><Clock className="h-3 w-3 inline mr-0.5" />{dlLabel}</span>
                                    )}
                                  </div>
                                  <div className="font-mono text-sm font-bold text-neon-green shrink-0">{fmtEth(b.amount)} ETH</div>
                                </div>
                                <div className="font-display text-sm font-extrabold uppercase">{b.title || "(Untitled)"}</div>
                                {bIsAssigned && (
                                  <div className="font-mono text-xs text-muted-foreground">Assigned to: {b.assignedTo.slice(0,8)}…{b.assignedTo.slice(-4)}</div>
                                )}
                                {bIsPRSubmitted && b.prUrl && (
                                  <a href={b.prUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-neon-cyan hover:underline flex items-center gap-1">
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
                                        className="w-24 border-2 border-border bg-background px-2 py-1 font-mono text-xs focus:border-neon-green focus:outline-none" />
                                      <button onClick={() => handleIncreaseBounty(b.id)} disabled={increasingId === b.id}
                                        className="brutal-btn flex items-center gap-1 border-neon-green bg-neon-green/10 px-2 py-1 font-mono text-xs font-bold text-neon-green disabled:opacity-60">
                                        {increasingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />} INCREASE
                                      </button>
                                    </div>
                                  )}

                                  {/* Cancel (OPEN only) */}
                                  {bIsOpen && (
                                    <button onClick={() => handleCancelBounty(b.id)} disabled={cancellingId === b.id}
                                      className="brutal-btn flex items-center gap-1 border-neon-red bg-neon-red/10 px-2 py-1 font-mono text-xs font-bold text-neon-red disabled:opacity-60">
                                      {cancellingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} CANCEL
                                    </button>
                                  )}

                                  {/* Approve / Reject PR */}
                                  {bIsPRSubmitted && (
                                    <>
                                      <button onClick={() => handleApproveMerge(b.id)} disabled={approvingId === b.id}
                                        className="brutal-btn flex items-center gap-1 border-neon-green bg-neon-green px-3 py-1 font-mono text-xs font-bold text-primary-foreground disabled:opacity-60">
                                        {approvingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} APPROVE
                                      </button>
                                      <button onClick={() => handleRejectPR(b.id)} disabled={rejectingId === b.id}
                                        className="brutal-btn flex items-center gap-1 border-neon-red bg-neon-red/10 px-3 py-1 font-mono text-xs font-bold text-neon-red disabled:opacity-60">
                                        {rejectingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} REJECT
                                      </button>
                                    </>
                                  )}

                                  <a href={b.githubIssueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-neon-cyan hover:underline">
                                    Issue <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
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

          {/* ── AGENTS TAB ── */}
          {activeTab === "agents" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">NEAR AI Agents</h2>
                <div className="flex items-center gap-2 border-2 border-neon-cyan bg-neon-cyan/10 px-2.5 py-1">
                  <span className="status-dot status-dot-cyan" />
                  <span className="font-mono text-xs font-bold text-neon-cyan">3 ACTIVE</span>
                </div>
              </div>
              <div className="brutal-card-cyan">
                <div className="flex items-center justify-between border-b-2 border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-neon-cyan">
                      <Brain className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold uppercase">mergeX-agent-001</div>
                      <div className="font-mono text-xs text-muted-foreground">Reviewing latest bounty</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5"><span className="status-dot status-dot-cyan" /><span className="font-mono text-xs font-bold text-neon-cyan">PRIVATE INFERENCE</span></div>
                    <RefreshCw className="h-4 w-4 animate-spin text-neon-cyan" />
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">// agent_log.stream</div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {AGENT_LOGS.map((log) => (
                      <div key={log.id} className="flex gap-3">
                        <span className="shrink-0 text-muted-foreground/50">{log.time}</span>
                        <span className={`shrink-0 font-bold ${LOG_STYLE[log.type]}`}>{LOG_PREFIX[log.type]}</span>
                        <span className={LOG_STYLE[log.type]}>{log.message}</span>
                      </div>
                    ))}
                    <div className="flex gap-3">
                      <span className="shrink-0 text-muted-foreground/50">14:32:31</span>
                      <span className="font-bold text-neon-cyan">[INFO]</span>
                      <span className="text-neon-cyan">Waiting for PR submission...<span className="animate-terminal-blink">█</span></span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { title: "Private Inference", desc: "Your code never touches a public LLM. NEAR TEE-protected.", icon: Lock, cardStyle: "brutal-card-cyan" },
                  { title: "Tab-Closed Mode", desc: "Agent continues autonomously after user disconnects.", icon: Zap, cardStyle: "brutal-card-green" },
                  { title: "User-Owned Memory", desc: "Reputation & review history stored on NEAR — portable across apps.", icon: Database, cardStyle: "brutal-card-amber" },
                ].map((f) => (
                  <div key={f.title} className={`${f.cardStyle} p-4`}>
                    <f.icon className="mb-3 h-5 w-5 text-foreground" />
                    <div className="mb-1 font-display text-base font-extrabold uppercase">{f.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STORAGE TAB ── */}
          {activeTab === "storage" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Filecoin Audit Archive</h2>
                <span className="border-2 border-neon-amber bg-neon-amber/10 px-2.5 py-1 font-mono text-xs font-bold text-neon-amber">SYNAPSE SDK</span>
              </div>
              <div className="brutal-card-amber p-4">
                <div className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">// pinned_records</div>
                <div className="font-mono text-xs text-muted-foreground">Audit trail CIDs will appear here after review completion.</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="brutal-card p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center border-2 border-border bg-neon-amber"><HardDrive className="h-4 w-4 text-primary-foreground" /></div>
                  <div className="font-mono text-3xl font-bold text-neon-amber">0</div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Records Pinned</div>
                </div>
                <div className="brutal-card p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center border-2 border-border bg-neon-green"><TrendingUp className="h-4 w-4 text-primary-foreground" /></div>
                  <div className="font-mono text-xl font-bold text-neon-green">Calibration</div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Active Testnet</div>
                </div>
              </div>
            </div>
          )}

          {/* ── IDENTITY TAB ── */}
          {activeTab === "identity" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-extrabold uppercase">Identity & Verification</h2>
              <div className="brutal-card-green">
                <div className="flex items-center justify-between p-4 border-b-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-neon-green"><Globe className="h-5 w-5 text-primary-foreground" /></div>
                    <div>
                      <div className="font-display text-base font-extrabold uppercase">Wallet</div>
                      <div className="font-mono text-xs text-muted-foreground">Connected address</div>
                    </div>
                  </div>
                  {isConnected ? (
                    <div className="flex items-center gap-2 border-2 border-neon-green bg-neon-green px-3 py-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />
                      <span className="font-mono text-xs font-bold text-primary-foreground">CONNECTED</span>
                    </div>
                  ) : <WalletButton />}
                </div>
                <div className="p-4">
                  {isConnected ? <div className="font-mono text-sm font-bold text-neon-green break-all">{address}</div>
                    : <div className="font-mono text-xs text-muted-foreground">No wallet connected</div>}
                </div>
              </div>
              <div className="brutal-card p-4">
                <div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-neon-cyan" /><span className="font-display text-base font-extrabold uppercase">On-Chain Activity</span></div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Bounties Taken", value: myBounties.length, sub: "Active & completed" },
                    { label: "In Progress", value: myBounties.filter((b) => b.status === 1 || b.status === 2).length, sub: "ASSIGNED or PR submitted" },
                    { label: "Completed", value: myBounties.filter((b) => b.status === 4).length, sub: "Claimed & done" },
                  ].map((r) => (
                    <div key={r.label} className="border-2 border-border bg-surface-2 p-3">
                      <div className="font-mono text-xl font-bold text-neon-cyan">{r.value}</div>
                      <div className="font-display text-sm font-bold uppercase">{r.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="brutal-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div><div className="font-display text-base font-extrabold uppercase">Human-to-Bot Ratio</div><div className="font-mono text-xs text-muted-foreground">Platform-wide metric</div></div>
                  <div className="font-mono text-4xl font-bold text-neon-green">100%</div>
                </div>
                <div className="h-4 border-2 border-border bg-surface-2"><div className="h-full w-full bg-neon-green" /></div>
                <div className="mt-2 flex justify-between font-mono text-xs uppercase text-muted-foreground"><span>0% Bots</span><span>World ID verified</span></div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
