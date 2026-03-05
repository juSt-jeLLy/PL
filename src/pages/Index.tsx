import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, GitBranch, Eye, Database, Zap, CheckCircle, ArrowRight, Globe, Brain, HardDrive, Lock, ChevronRight, Users, Star, Activity } from "lucide-react";
import WorldIDVerify from "@/components/WorldIDVerify";

const NAV_LINKS = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Architecture", href: "#architecture" },
  { label: "Bounties", href: "#bounties" },
];

const TECH_STACK = [
  {
    layer: "Identity",
    tech: "World ID",
    icon: Globe,
    color: "green" as const,
    description: "Orb-verified proof of personhood. One human = one worker.",
    badge: "Sybil-Proof",
  },
  {
    layer: "Execution",
    tech: "World Chain (L2)",
    icon: Zap,
    color: "green" as const,
    description: "Gas-free transactions for verified humans. Staking & escrow contracts.",
    badge: "Gas-Free",
  },
  {
    layer: "Intelligence",
    tech: "NEAR Private AI",
    icon: Brain,
    color: "cyan" as const,
    description: "Autonomous agents that keep running after you close the tab. Private inference protects your IP.",
    badge: "Always-On",
  },
  {
    layer: "Storage",
    tech: "Filecoin (Synapse)",
    icon: HardDrive,
    color: "amber" as const,
    description: "Permanent, verifiable audit trails. Every AI review pinned to Filecoin.",
    badge: "Immutable",
  },
  {
    layer: "Frontend",
    tech: "Mini App (Web)",
    icon: Eye,
    color: "cyan" as const,
    description: "Runs inside the World App. Human-only workspace dashboard.",
    badge: "Mini App",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Verify Your Humanity",
    desc: "Connect World App and complete Orb verification. Your nullifierHash is stored on World Chain — only one account per human.",
    icon: Globe,
    color: "green" as const,
  },
  {
    step: "02",
    title: "Post or Claim a Bounty",
    desc: "Repo owners stake tokens against security issues. Contributors browse and claim open bounties by depositing collateral.",
    icon: GitBranch,
    color: "cyan" as const,
  },
  {
    step: "03",
    title: "NEAR Agent Reviews Code",
    desc: "When a PR is submitted, a NEAR Private AI agent spins up autonomously. It performs private inference — your code never touches a public LLM.",
    icon: Brain,
    color: "cyan" as const,
  },
  {
    step: "04",
    title: "Audit Trail Pinned to Filecoin",
    desc: "Every review step, vulnerability report, and reputation score is stored via Synapse SDK on Filecoin. Immutable and verifiable forever.",
    icon: HardDrive,
    color: "amber" as const,
  },
  {
    step: "05",
    title: "Bounty Released On-Chain",
    desc: "The NEAR agent signals approval to your World Chain escrow contract. Payout is automatic — no human gatekeeper needed.",
    icon: CheckCircle,
    color: "green" as const,
  },
];

const STATS = [
  { label: "Human Verifications", value: "12,483", icon: Users, color: "green" as const },
  { label: "Active Bounties", value: "374", icon: Star, color: "cyan" as const },
  { label: "Agent Reviews Today", value: "1,209", icon: Activity, color: "amber" as const },
  { label: "Human-to-Bot Ratio", value: "100%", icon: Shield, color: "green" as const },
];

const cardClass: Record<string, string> = {
  green: "brutal-card-green",
  cyan: "brutal-card-cyan",
  amber: "brutal-card-amber",
};

const textColor: Record<string, string> = {
  green: "text-neon-green",
  cyan: "text-neon-cyan",
  amber: "text-neon-amber",
};

const bgColor: Record<string, string> = {
  green: "bg-neon-green",
  cyan: "bg-neon-cyan",
  amber: "bg-neon-amber",
};

export default function Index() {
  const [terminalText, setTerminalText] = useState("");
  const fullText = "Initializing mergeX 2026... World ID verified. NEAR agents online. Filecoin storage ready.";

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTerminalText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 28);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b-2 border-border bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-neon-green">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-extrabold uppercase tracking-tight">
              merge<span className="text-neon-green">X</span>
              <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">2026</span>
            </span>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-neon-green"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 border-2 border-neon-green bg-neon-green/10 px-3 py-1.5">
              <span className="status-dot status-dot-green" />
              <span className="font-mono text-xs font-bold text-neon-green">MAINNET</span>
            </div>
            <Link
              to="/dashboard"
              className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-4 py-1.5 font-mono text-sm text-primary-foreground"
            >
              Launch App <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center pt-16">
        <div className="container relative z-10 mx-auto px-6 text-center">
          {/* Terminal bar */}
          <div className="mb-10 inline-flex items-center gap-3 border-2 border-border bg-card px-5 py-3 shadow-brutal-sm">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 border border-border bg-neon-red" />
              <span className="h-3 w-3 border border-border bg-neon-amber" />
              <span className="h-3 w-3 border border-border bg-neon-green" />
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {terminalText}
              <span className="animate-terminal-blink">█</span>
            </span>
          </div>

          {/* Headline */}
          <h1 className="mb-6 font-display text-6xl font-extrabold uppercase leading-none tracking-tighter md:text-8xl">
            Decentralized
            <br />
            <span className="text-neon-green">Open</span>{" "}
            <span className="text-neon-cyan">Source</span>
            <br />
            
          </h1>

          <p className="mx-auto mb-10 max-w-2xl font-mono text-base text-muted-foreground md:text-lg">
            World ID-gated · NEAR-agent-reviewed · Filecoin-archived.
            <br />
            The only bounty platform where{" "}
            <span className="font-bold text-neon-green">every worker is a verified human</span> and
            every review is <span className="font-bold text-neon-cyan">privately audited by AI</span>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/add-repo"
              className="brutal-btn group flex items-center gap-2 border-neon-green bg-neon-green px-8 py-4 font-mono text-sm text-primary-foreground"
            >
              <Shield className="h-4 w-4" />
              Add Repo
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="brutal-btn flex items-center gap-2 border-border bg-card px-8 py-4 font-mono text-sm text-foreground"
            >
              How It Works
            </a>
          </div>

          {/* Stats Row */}
          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="brutal-card p-5 text-left"
              >
                <div className={`mb-2 flex h-8 w-8 items-center justify-center border-2 border-border ${bgColor[s.color]}`}>
                  <s.icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className={`font-mono text-3xl font-bold ${textColor[s.color]}`}>
                  {s.value}
                </div>
                <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
                  <section className="py-24 border-t-2 border-border bg-surface-1/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border-2 border-neon-green bg-neon-green">
              <Globe className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-4xl font-extrabold uppercase mb-4">
              Verify Your <span className="text-neon-green">Humanity</span>
            </h2>
            <p className="font-mono text-muted-foreground max-w-2xl mx-auto">
              Join the verified human ecosystem. Connect your World ID to prove you're human and gain access to mergeX bounties.
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="brutal-card p-8 bg-card border-2 border-border">
              <React.Suspense 
                fallback={
                  <div className="flex flex-col items-center gap-4 p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div>
                    <p className="font-mono text-sm text-muted-foreground">Loading World ID verification...</p>
                  </div>
                }
              >
                <WorldIDVerify />
              </React.Suspense>
            </div>
          </div>
        </div>
      </section>
      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16">
            <span className="brutal-btn mb-4 inline-block border-neon-green bg-neon-green px-3 py-1 font-mono text-xs text-primary-foreground">
              WORKFLOW
            </span>
            <h2 className="font-display text-5xl font-extrabold uppercase tracking-tighter">
              How mergeX Works
            </h2>
            <p className="mt-3 font-mono text-sm text-muted-foreground">End-to-end autonomous security bounties.</p>
          </div>

          <div className="space-y-4">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className={`${cardClass[item.color]} flex gap-5 p-6 transition-all`}
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center border-2 border-border ${bgColor[item.color]}`}>
                  <span className="font-mono text-lg font-bold text-primary-foreground">{item.step}</span>
                </div>
                <div>
                  <h3 className="mb-2 font-display text-xl font-extrabold uppercase">{item.title}</h3>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="border-y-2 border-border bg-card py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16">
            <span className="brutal-btn mb-4 inline-block border-neon-cyan bg-neon-cyan px-3 py-1 font-mono text-xs text-primary-foreground">
              TECH STACK
            </span>
            <h2 className="font-display text-5xl font-extrabold uppercase tracking-tighter">
              Technical Architecture
            </h2>
            <p className="mt-3 font-mono text-sm text-muted-foreground">Four protocols. One autonomous system.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TECH_STACK.map((t) => (
              <div
                key={t.layer}
                className={`${cardClass[t.color]} p-6`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center border-2 border-border ${bgColor[t.color]}`}>
                    <t.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className={`border-2 px-2 py-0.5 font-mono text-xs font-bold uppercase ${textColor[t.color]} border-current`}>
                    {t.badge}
                  </span>
                </div>
                <div className="mb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {t.layer}
                </div>
                <h3 className={`mb-3 font-display text-xl font-extrabold uppercase ${textColor[t.color]}`}>
                  {t.tech}
                </h3>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>

          {/* Architecture flow */}
          <div className="mt-8 brutal-card p-6">
            <div className="mb-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">// architecture_flow</div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-center gap-3 font-mono text-sm">
                {[
                  { label: "User", color: "green" },
                  { label: "World ID Gate", color: "green" },
                  { label: "World Chain", color: "green" },
                  { label: "NEAR Agent", color: "cyan" },
                  { label: "Filecoin CID", color: "amber" },
                  { label: "Payout ✓", color: "green" },
                ].map((node, i, arr) => (
                  <React.Fragment key={node.label}>
                    <div
                      className={`border-2 border-current px-4 py-2 font-bold uppercase ${textColor[node.color as keyof typeof textColor]}`}
                    >
                      {node.label}
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bounty Highlights */}
      <section id="bounties" className="py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16">
            <span className="brutal-btn mb-4 inline-block border-neon-amber bg-neon-amber px-3 py-1 font-mono text-xs text-primary-foreground">
              BOUNTIES
            </span>
            <h2 className="font-display text-5xl font-extrabold uppercase tracking-tighter">
              Active Bounties
            </h2>
            <p className="mt-3 font-mono text-sm text-muted-foreground">All claimants are World ID verified.</p>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-green" />
              <span className="font-mono text-sm font-bold text-neon-green">374 OPEN</span>
            </div>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 font-mono text-sm font-bold uppercase text-neon-cyan hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <BountyPreviewList />
        </div>
      </section>

      {/* CTA Banner */}
      {/* <section className="border-y-2 border-border bg-card py-24">
        <div className="container mx-auto px-6 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border-2 border-neon-green bg-neon-green animate-float">
              <Lock className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="mb-4 font-display text-5xl font-extrabold uppercase tracking-tighter">
              Ready to secure the{" "}
              <span className="text-neon-green">open-source</span>{" "}
              <span className="text-neon-cyan">ecosystem?</span>
            </h2>
            <p className="mb-8 font-mono text-sm text-muted-foreground">
              Verify your humanity with World ID and start earning or posting bounties today.
              Your code is safe — NEAR agents review privately.
            </p>
            <Link
              to="/dashboard"
              className="brutal-btn inline-flex items-center gap-2 border-neon-green bg-neon-green px-8 py-4 font-mono text-sm text-primary-foreground"
            >
              <Shield className="h-5 w-5" />
              Get Started — Verify with World ID
            </Link>
          </div>
        </div>
      </section> */}

      {/* World ID Verification Section */}
      {/* <section className="py-24 border-t-2 border-border bg-surface-1/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border-2 border-neon-green bg-neon-green">
              <Globe className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-4xl font-extrabold uppercase mb-4">
              Verify Your <span className="text-neon-green">Humanity</span>
            </h2>
            <p className="font-mono text-muted-foreground max-w-2xl mx-auto">
              Join the verified human ecosystem. Connect your World ID to prove you're human and gain access to mergeX bounties.
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="brutal-card p-8 bg-card border-2 border-border">
              <React.Suspense 
                fallback={
                  <div className="flex flex-col items-center gap-4 p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div>
                    <p className="font-mono text-sm text-muted-foreground">Loading World ID verification...</p>
                  </div>
                }
              >
                <WorldIDVerify />
              </React.Suspense>
            </div>
          </div>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="border-t-2 border-border py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center border border-border bg-neon-green">
              <Shield className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-mono text-sm font-bold uppercase">
              merge<span className="text-neon-green">X</span> 2026
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span>World Chain</span>
            <span>·</span>
            <span>NEAR AI</span>
            <span>·</span>
            <span>Filecoin</span>
            <span>·</span>
            <span>PL Genesis 2026</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-dot-green" />
            <span className="font-mono text-xs font-bold text-neon-green">ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Inline bounty preview component
const SAMPLE_BOUNTIES = [
  {
    id: "SG-0421",
    repo: "defi-protocol/vault-core",
    title: "Reentrancy vulnerability in withdraw()",
    severity: "CRITICAL",
    reward: "2,500 WLD",
    status: "Open",
    tags: ["Solidity", "DeFi"],
  },
  {
    id: "SG-0419",
    repo: "zk-bridge/relayer",
    title: "Off-by-one in merkle proof validation",
    severity: "HIGH",
    reward: "800 WLD",
    status: "Claimed",
    tags: ["ZK", "Circuits"],
  },
  {
    id: "SG-0415",
    repo: "lending-dao/oracle",
    title: "Price manipulation via flash loans",
    severity: "HIGH",
    reward: "1,200 WLD",
    status: "Open",
    tags: ["Oracle", "Flash Loan"],
  },
];

function BountyPreviewList() {
  return (
    <div className="space-y-4">
      {SAMPLE_BOUNTIES.map((b) => (
        <Link
          to="/dashboard"
          key={b.id}
          className="brutal-card group flex flex-col gap-3 p-5 md:flex-row md:items-center"
        >
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">{b.id}</span>
              <span
                className={`border-2 px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                  b.severity === "CRITICAL"
                    ? "border-neon-red bg-neon-red/10 text-neon-red"
                    : "border-neon-amber bg-neon-amber/10 text-neon-amber"
                }`}
              >
                {b.severity}
              </span>
              {b.tags.map((tag) => (
                <span
                  key={tag}
                  className="border-2 border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mb-1 font-display text-lg font-extrabold uppercase group-hover:text-neon-green transition-colors">
              {b.title}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{b.repo}</div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <div className="font-mono text-lg font-bold text-neon-green">{b.reward}</div>
              <div
                className={`font-mono text-xs font-bold uppercase ${
                  b.status === "Open" ? "text-neon-green" : "text-muted-foreground"
                }`}
              >
                {b.status}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
