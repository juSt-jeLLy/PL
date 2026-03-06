import { ExternalLink, Shield, Loader2 } from "lucide-react";
import { RepoSnapshot } from "../types/repo";

interface RepositoryDetailsProps {
  result: RepoSnapshot;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
}

export function RepositoryDetails({ result, isAnalyzing, onRunAnalysis }: RepositoryDetailsProps) {
  return (
    <section className="border-2 border-border bg-card p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold uppercase">
          Repository Details
        </h2>
        <a
          href={result.repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-mono text-sm text-neon-cyan hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          View on GitHub
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Name
          </div>
          <div className="font-mono text-sm">{result.repo.name}</div>
        </div>
        <div className="border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Owner
          </div>
          <div className="font-mono text-sm">{result.repo.fullName.split("/")[0]}</div>
        </div>
        <div className="border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Language
          </div>
          <div className="font-mono text-sm">{result.repo.language || "N/A"}</div>
        </div>
        <div className="border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Stars
          </div>
          <div className="font-mono text-sm">{result.repo.stars.toLocaleString()}</div>
        </div>
        <div className="border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Forks
          </div>
          <div className="font-mono text-sm">{result.repo.forks.toLocaleString()}</div>
        </div>
        <div className="border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Issues
          </div>
          <div className="font-mono text-sm">{result.repo.openIssuesCount.toLocaleString()}</div>
        </div>
      </div>

      {result.repo.description && (
        <div className="mt-4 border-2 border-border bg-background p-3">
          <div className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Description
          </div>
          <div className="font-mono text-sm">{result.repo.description}</div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="brutal-btn inline-flex items-center gap-2 border-neon-cyan bg-neon-cyan px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground disabled:opacity-70"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Run Security Analysis
            </>
          )}
        </button>
      </div>
    </section>
  );
}
