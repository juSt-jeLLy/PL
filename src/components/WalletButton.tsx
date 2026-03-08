import { useState } from "react";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, AlertTriangle, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { WORLD_CHAIN_SEPOLIA } from "@/lib/contract";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletButton() {
  const { address, isConnected, isConnecting, balance, chainId, isCorrectChain, connect, disconnect, switchToWorldChainSepolia } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="brutal-btn flex items-center gap-1.5 border-neon-green bg-neon-green px-3 py-1.5 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-60"
      >
        {isConnecting ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting…</>
        ) : (
          <><Wallet className="h-3.5 w-3.5" />Connect Wallet</>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Wrong chain banner inside button */}
      {!isCorrectChain && (
        <button
          onClick={switchToWorldChainSepolia}
          className="brutal-btn flex items-center gap-1.5 border-neon-amber bg-neon-amber/20 px-3 py-1.5 font-mono text-xs font-bold uppercase text-neon-amber mr-1"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Wrong Network
        </button>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="brutal-btn flex items-center gap-1.5 border-border bg-card px-3 py-1.5 font-mono text-xs font-bold uppercase text-foreground hover:border-neon-green"
      >
        <div className="h-2 w-2 rounded-full bg-neon-green" />
        {truncate(address!)}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 border-2 border-border bg-card shadow-brutal-sm">
            {/* Profile header */}
            <div className="border-b-2 border-border p-3">
              <div className="mb-1 font-mono text-xs font-bold uppercase text-muted-foreground">Connected Wallet</div>
              <div className="font-mono text-sm font-bold text-neon-green break-all">{address}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{balance} ETH</span>
                <span className={`border px-1.5 py-0.5 font-mono text-xs font-bold ${isCorrectChain ? "border-neon-green/40 text-neon-green" : "border-neon-amber/40 text-neon-amber"}`}>
                  {isCorrectChain ? WORLD_CHAIN_SEPOLIA.name : `Chain ${chainId}`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-0.5 p-1.5">
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-bold uppercase text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <a
                href={`${WORLD_CHAIN_SEPOLIA.blockExplorer}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-bold uppercase text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Explorer
              </a>
              {!isCorrectChain && (
                <button
                  onClick={() => { switchToWorldChainSepolia(); setOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-bold uppercase text-neon-amber hover:bg-neon-amber/10"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Switch to World Chain
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => { disconnect(); setOpen(false); }}
                className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-bold uppercase text-neon-red hover:bg-neon-red/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
