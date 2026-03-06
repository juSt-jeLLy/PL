import { FormEvent } from "react";
import { Loader2 } from "lucide-react";

interface RepositoryFormProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  loading: boolean;
  canFetch: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  statusMessage: string | null;
}

export function RepositoryForm({ 
  repoUrl, 
  setRepoUrl, 
  loading, 
  canFetch, 
  onSubmit, 
  error, 
  statusMessage 
}: RepositoryFormProps) {
  return (
    <section className="border-2 border-border bg-card p-4 md:p-6">
      <h2 className="mb-4 font-display text-xl font-extrabold uppercase">
        Add Repository
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="repo-url"
            className="mb-2 block font-mono text-sm font-bold uppercase"
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
                "Fetch Repository"
              )}
            </button>
            {!canFetch && (
              <span className="font-mono text-xs text-muted-foreground">
                Enter a URL first
              </span>
            )}
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-4 border-2 border-red-500 bg-red-500/10 p-3 text-red-400">
          <div className="font-mono text-sm font-bold">Error</div>
          <div className="font-mono text-xs">{error}</div>
        </div>
      )}

      {statusMessage && (
        <div className="mt-4 border-2 border-neon-amber bg-neon-amber/10 p-3 text-neon-amber">
          <div className="font-mono text-sm">{statusMessage}</div>
        </div>
      )}
    </section>
  );
}
