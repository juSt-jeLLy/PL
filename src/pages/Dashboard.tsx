import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, GitBranch, Brain, HardDrive, Globe, Activity,
  CheckCircle, Clock, AlertTriangle, ArrowLeft, Plus,
  Users, Database, Zap, ChevronRight, Eye, Lock,
  ExternalLink, RefreshCw, FileText, TrendingUp
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type BountyStatus = "Open" | "In Review" | "Claimed" | "Resolved";
type AgentStatus = "idle" | "reviewing" | "complete" | "error";

interface Bounty {
  id: string;
  repo: string;
  title: string;
  severity: SeverityLevel;
  reward: string;
  status: BountyStatus;
  tags: string[];
  agentStatus: AgentStatus;
  filecoinCID?: string;
  claimedBy?: string;
  submittedAt: string;
}

interface AgentLog {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const BOUNTIES: Bounty[] = [
  {
    id: "SG-0421",
    repo: "defi-protocol/vault-core",
    title: "Reentrancy vulnerability in withdraw()",
    severity: "CRITICAL",
    reward: "2,500 WLD",
    status: "In Review",
    tags: ["Solidity", "DeFi", "EVM"],
    agentStatus: "reviewing",
    submittedAt: "2h ago",
  },
  {
    id: "SG-0420",
    repo: "nft-marketplace/escrow",
    title: "Access control bypass in transferOwnership",
    severity: "HIGH",
    reward: "1,800 WLD",
    status: "Open",
    tags: ["NFT", "Access Control"],
    agentStatus: "idle",
    submittedAt: "5h ago",
  },
  {
    id: "SG-0419",
    repo: "zk-bridge/relayer",
    title: "Off-by-one in merkle proof validation",
    severity: "HIGH",
    reward: "800 WLD",
    status: "Claimed",
    tags: ["ZK", "Circuits"],
    agentStatus: "complete",
    filecoinCID: "bafybeih4x2q3kv...",
    claimedBy: "0xd3a...f92",
    submittedAt: "1d ago",
  },
  {
    id: "SG-0418",
    repo: "lending-dao/oracle",
    title: "Price manipulation via flash loans",
    severity: "HIGH",
    reward: "1,200 WLD",
    status: "Open",
    tags: ["Oracle", "Flash Loan"],
    agentStatus: "idle",
    submittedAt: "1d ago",
  },
  {
    id: "SG-0417",
    repo: "governance/timelock",
    title: "Integer overflow in vote tallying",
    severity: "MEDIUM",
    reward: "400 WLD",
    status: "Resolved",
    tags: ["Governance", "Math"],
    agentStatus: "complete",
    filecoinCID: "bafybeig7k1tqp...",
    submittedAt: "3d ago",
  },
  {
    id: "SG-0415",
    repo: "staking/rewards",
    title: "Unchecked return value from transfer()",
    severity: "MEDIUM",
    reward: "300 WLD",
    status: "Resolved",
    tags: ["ERC-20", "Staking"],
    agentStatus: "complete",
    filecoinCID: "bafybeicy8mn2r...",
    submittedAt: "4d ago",
  },
];

const AGENT_LOGS: AgentLog[] = [
  { id: "1", time: "14:32:01", message: "NEAR agent spawned for SG-0421 — private inference mode ON", type: "info" },
  { id: "2", time: "14:32:04", message: "Loading repo context: defi-protocol/vault-core @ commit 3f8a2c1", type: "info" },
  { id: "3", time: "14:32:18", message: "Static analysis complete: 3 potential issues flagged", type: "warn" },
  { id: "4", time: "14:32:21", message: "Pattern match: CEI violation detected in withdraw() line 147", type: "error" },
  { id: "5", time: "14:32:25", message: "Generating proof-of-review bundle...", type: "info" },
  { id: "6", time: "14:32:28", message: "Audit trail pinned to Filecoin via Synapse SDK", type: "success" },
  { id: "7", time: "14:32:29", message: "CID: bafybeih4x2q3kv8mza — immutable record created", type: "success" },
  { id: "8", time: "14:32:30", message: "Notifying World Chain escrow contract...", type: "info" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const severityStyle: Record<SeverityLevel, string> = {
  CRITICAL: "border-neon-red bg-neon-red/10 text-neon-red",
  HIGH: "border-neon-amber bg-neon-amber/10 text-neon-amber",
  MEDIUM: "border-yellow-500 bg-yellow-500/10 text-yellow-400",
  LOW: "border-border bg-surface-2 text-muted-foreground",
};

const statusStyle: Record<BountyStatus, string> = {
  Open: "text-neon-green",
  "In Review": "text-neon-cyan",
  Claimed: "text-neon-amber",
  Resolved: "text-muted-foreground",
};

const agentDot: Record<AgentStatus, string> = {
  idle: "status-dot-amber",
  reviewing: "status-dot-cyan",
  complete: "status-dot-green",
  error: "bg-neon-red",
};

const logStyle: Record<AgentLog["type"], string> = {
  info: "text-muted-foreground",
  success: "text-neon-green",
  warn: "text-neon-amber",
  error: "text-neon-red",
};

const logPrefix: Record<AgentLog["type"], string> = {
  info: "[INFO]",
  success: "[OK]  ",
  warn: "[WARN]",
  error: "[ERR] ",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"bounties" | "agents" | "storage" | "identity">("bounties");
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [worldIdVerified] = useState(true);

  const openBounties = BOUNTIES.filter((b) => b.status === "Open").length;
  const resolvedBounties = BOUNTIES.filter((b) => b.status === "Resolved").length;

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
            {worldIdVerified ? (
              <div className="flex items-center gap-1.5 border-2 border-neon-green bg-neon-green/10 px-2.5 py-1">
                <Globe className="h-3.5 w-3.5 text-neon-green" />
                <span className="font-mono text-xs font-bold text-neon-green">WORLD ID ✓</span>
              </div>
            ) : (
              <button className="flex items-center gap-1.5 border-2 border-neon-amber bg-neon-amber/10 px-2.5 py-1">
                <Globe className="h-3.5 w-3.5 text-neon-amber" />
                <span className="font-mono text-xs font-bold text-neon-amber">VERIFY</span>
              </button>
            )}
            <button className="brutal-btn flex items-center gap-1.5 border-border bg-card px-3 py-1 font-mono text-xs text-foreground">
              <Plus className="h-3.5 w-3.5" />
              NEW BOUNTY
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-0 md:flex-row">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r-2 border-border bg-sidebar md:flex md:flex-col">
          <div className="flex flex-col gap-1 p-3">
            {(
              [
                { id: "bounties", label: "Bounties", icon: GitBranch, count: openBounties },
                { id: "agents", label: "NEAR Agents", icon: Brain, count: null },
                { id: "storage", label: "Filecoin Logs", icon: HardDrive, count: null },
                { id: "identity", label: "Identity", icon: Globe, count: null },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-3 py-2.5 text-left font-mono text-sm font-bold uppercase tracking-wider transition-colors ${
                  activeTab === item.id
                    ? "border-2 border-neon-green bg-neon-green/10 text-neon-green"
                    : "border-2 border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {item.count !== null && (
                  <span className="border-2 border-neon-green bg-neon-green px-1.5 py-0.5 font-mono text-xs text-primary-foreground">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Chain status */}
          <div className="mt-auto border-t-2 border-border p-3">
            <div className="space-y-2.5">
              {[
                { label: "World Chain", dot: "status-dot-green" },
                { label: "NEAR AI", dot: "status-dot-cyan" },
                { label: "Filecoin", dot: "status-dot-green" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className={`status-dot ${s.dot}`} />
                  <span className="font-mono text-xs font-bold uppercase text-sidebar-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {/* Mobile tab bar */}
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {["bounties", "agents", "storage", "identity"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`shrink-0 border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                  activeTab === tab
                    ? "border-neon-green bg-neon-green/10 text-neon-green"
                    : "border-border text-muted-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Stats Row */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Open Bounties", value: openBounties, icon: GitBranch, color: "green" },
              { label: "Agents Active", value: "3", icon: Brain, color: "cyan" },
              { label: "Resolved", value: resolvedBounties, icon: CheckCircle, color: "green" },
              { label: "Human Ratio", value: "100%", icon: Users, color: "green" },
            ].map((s) => (
              <div key={s.label} className="brutal-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className={`flex h-7 w-7 items-center justify-center border-2 border-border ${s.color === "cyan" ? "bg-neon-cyan" : "bg-neon-green"}`}>
                    <s.icon className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <span className={`status-dot ${s.color === "cyan" ? "status-dot-cyan" : "status-dot-green"}`} />
                </div>
                <div className={`font-mono text-2xl font-bold ${s.color === "cyan" ? "text-neon-cyan" : "text-neon-green"}`}>
                  {s.value}
                </div>
                <div className="mt-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* BOUNTIES TAB */}
          {activeTab === "bounties" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Security Bounties</h2>
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot-green" />
                  <span className="font-mono text-xs font-bold text-neon-green">{openBounties} OPEN</span>
                </div>
              </div>

              {BOUNTIES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBounty(b === selectedBounty ? null : b)}
                  className={`w-full text-left transition-all brutal-card ${
                    selectedBounty?.id === b.id
                      ? "!border-neon-green !shadow-brutal-green"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">{b.id}</span>
                        <span className={`border-2 px-1.5 py-0.5 font-mono text-xs font-bold uppercase ${severityStyle[b.severity]}`}>
                          {b.severity}
                        </span>
                        {b.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="border-2 border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mb-1 truncate font-display text-base font-extrabold uppercase">{b.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">{b.repo} · {b.submittedAt}</div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`status-dot ${agentDot[b.agentStatus]}`} />
                        <span className="font-mono text-xs font-bold uppercase text-muted-foreground">{b.agentStatus}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold text-neon-green">{b.reward}</div>
                        <div className={`font-mono text-xs font-bold uppercase ${statusStyle[b.status]}`}>{b.status}</div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {selectedBounty?.id === b.id && (
                    <div className="border-t-2 border-border p-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">World Chain Contract</div>
                          <div className="font-mono text-xs font-bold text-neon-green">0x4aF...c29d</div>
                        </div>
                        <div>
                          <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">NEAR Agent</div>
                          <div className="flex items-center gap-1.5">
                            <span className={`status-dot ${agentDot[b.agentStatus]}`} />
                            <span className="font-mono text-xs font-bold uppercase">{b.agentStatus}</span>
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Filecoin CID</div>
                          {b.filecoinCID ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-neon-amber">
                              <span className="truncate">{b.filecoinCID}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">Pending review</span>
                          )}
                        </div>
                      </div>
                      {b.status === "Open" && (
                        <button className="brutal-btn mt-4 flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-2 font-mono text-sm text-primary-foreground">
                          <Lock className="h-3.5 w-3.5" />
                          CLAIM BOUNTY (WORLD ID REQUIRED)
                        </button>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* AGENTS TAB */}
          {activeTab === "agents" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">NEAR AI Agents</h2>
                <div className="flex items-center gap-2 border-2 border-neon-cyan bg-neon-cyan/10 px-2.5 py-1">
                  <span className="status-dot status-dot-cyan" />
                  <span className="font-mono text-xs font-bold text-neon-cyan">3 ACTIVE</span>
                </div>
              </div>

              {/* Active Agent Card */}
              <div className="brutal-card-cyan">
                <div className="flex items-center justify-between border-b-2 border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-neon-cyan">
                      <Brain className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold uppercase">mergeX-agent-001</div>
                      <div className="font-mono text-xs text-muted-foreground">Reviewing SG-0421</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="status-dot status-dot-cyan" />
                      <span className="font-mono text-xs font-bold text-neon-cyan">PRIVATE INFERENCE</span>
                    </div>
                    <RefreshCw className="h-4 w-4 animate-spin text-neon-cyan" />
                  </div>
                </div>

                {/* Terminal Log */}
                <div className="bg-background p-4">
                  <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">// agent_log.stream</div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {AGENT_LOGS.map((log) => (
                      <div key={log.id} className="flex gap-3">
                        <span className="shrink-0 text-muted-foreground/50">{log.time}</span>
                        <span className={`shrink-0 font-bold ${logStyle[log.type]}`}>{logPrefix[log.type]}</span>
                        <span className={logStyle[log.type]}>{log.message}</span>
                      </div>
                    ))}
                    <div className="flex gap-3">
                      <span className="shrink-0 text-muted-foreground/50">14:32:31</span>
                      <span className="font-bold text-neon-cyan">[INFO]</span>
                      <span className="text-neon-cyan">
                        Waiting for PR submission...
                        <span className="animate-terminal-blink">█</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent Features */}
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Private Inference",
                    desc: "Your code never touches a public LLM. NEAR TEE-protected.",
                    icon: Lock,
                    cardStyle: "brutal-card-cyan",
                  },
                  {
                    title: "Tab-Closed Mode",
                    desc: "Agent continues autonomously after user disconnects.",
                    icon: Zap,
                    cardStyle: "brutal-card-green",
                  },
                  {
                    title: "User-Owned Memory",
                    desc: "Reputation & review history stored on NEAR — portable across apps.",
                    icon: Database,
                    cardStyle: "brutal-card-amber",
                  },
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

          {/* STORAGE TAB */}
          {activeTab === "storage" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase">Filecoin Audit Archive</h2>
                <span className="border-2 border-neon-amber bg-neon-amber/10 px-2.5 py-1 font-mono text-xs font-bold text-neon-amber">
                  SYNAPSE SDK
                </span>
              </div>

              <div className="brutal-card-amber p-4">
                <div className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">// pinned_records</div>
                <div className="space-y-3">
                  {BOUNTIES.filter((b) => b.filecoinCID).map((b) => (
                    <div key={b.id} className="flex flex-col gap-2 border-2 border-border bg-surface-2 p-3 md:flex-row md:items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-3.5 w-3.5 text-neon-amber" />
                          <span className="font-mono text-xs font-bold text-neon-amber">{b.filecoinCID}</span>
                        </div>
                        <div className="font-display text-sm font-bold uppercase">{b.title}</div>
                        <div className="font-mono text-xs text-muted-foreground">{b.repo} · {b.id}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-neon-green" />
                          <span className="font-mono text-xs font-bold text-neon-green">PINNED</span>
                        </div>
                        <button className="flex items-center gap-1 font-mono text-xs font-bold text-neon-cyan hover:underline">
                          VIEW <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="brutal-card p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center border-2 border-border bg-neon-amber">
                    <HardDrive className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="font-mono text-3xl font-bold text-neon-amber">2</div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Records Pinned</div>
                </div>
                <div className="brutal-card p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center border-2 border-border bg-neon-green">
                    <TrendingUp className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="font-mono text-3xl font-bold text-neon-green">Calibration</div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Active Testnet</div>
                </div>
              </div>
            </div>
          )}

          {/* IDENTITY TAB */}
          {activeTab === "identity" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-extrabold uppercase">Identity & Verification</h2>

              {/* World ID Status */}
              <div className="brutal-card-green">
                <div className="flex items-center justify-between p-4 border-b-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-neon-green">
                      <Globe className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="font-display text-base font-extrabold uppercase">World ID</div>
                      <div className="font-mono text-xs text-muted-foreground">Orb-verified identity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-2 border-neon-green bg-neon-green px-3 py-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />
                    <span className="font-mono text-xs font-bold text-primary-foreground">VERIFIED</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3">
                  <div>
                    <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Nullifier Hash</div>
                    <div className="font-mono text-xs font-bold text-neon-green truncate">0x7f3a...d92e</div>
                  </div>
                  <div>
                    <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Verification Level</div>
                    <div className="font-mono text-xs font-bold text-neon-green">ORB</div>
                  </div>
                  <div>
                    <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Sybil Status</div>
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-neon-green">
                      <CheckCircle className="h-3 w-3" />
                      UNIQUE HUMAN
                    </div>
                  </div>
                </div>
              </div>

              {/* Human Ratio Widget */}
              <div className="brutal-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="font-display text-base font-extrabold uppercase">Human-to-Bot Ratio</div>
                    <div className="font-mono text-xs text-muted-foreground">Platform-wide metric</div>
                  </div>
                  <div className="font-mono text-4xl font-bold text-neon-green">100%</div>
                </div>
                <div className="h-4 border-2 border-border bg-surface-2">
                  <div className="h-full w-full bg-neon-green" />
                </div>
                <div className="mt-2 flex justify-between font-mono text-xs uppercase text-muted-foreground">
                  <span>0% Bots</span>
                  <span>12,483 verified humans</span>
                </div>
              </div>

              {/* Reputation */}
              <div className="brutal-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-neon-cyan" />
                  <span className="font-display text-base font-extrabold uppercase">NEAR Reputation Score</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Reviews Completed", value: "0", sub: "Start by claiming a bounty" },
                    { label: "Accuracy Rate", value: "—", sub: "No reviews yet" },
                    { label: "Reputation Tier", value: "Newcomer", sub: "Stored on NEAR" },
                  ].map((r) => (
                    <div key={r.label} className="border-2 border-border bg-surface-2 p-3">
                      <div className="font-mono text-xl font-bold text-neon-cyan">{r.value}</div>
                      <div className="font-display text-sm font-bold uppercase">{r.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
