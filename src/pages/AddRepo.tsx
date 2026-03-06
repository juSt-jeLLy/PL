import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

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

const INSTALL_PENDING_REPO_KEY = "mergex:pending-github-repo";

const formatDate = (isoDate?: string) => {
  if (!isoDate) {
    return "—";
  }
  return new Date(isoDate).toLocaleString();
};

const decodeStateRepo = (encodedState: string | null) => {
  if (!encodedState) {
    return null;
  }

  try {
    const decoded = atob(encodedState);
    const parsed = JSON.parse(decoded);
    if (typeof parsed?.repoUrl === "string" && parsed.repoUrl.trim()) {
      return parsed.repoUrl.trim();
    }
    return null;
  } catch {
    return null;
  }
};

export default function AddRepo() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RepoSnapshot | null>(null);

  const canFetch = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);

  const fetchRepoSnapshot = useCallback(async (rawRepo: string) => {
    const trimmedRepo = rawRepo.trim();
    if (!trimmedRepo) {
      setError("Enter a GitHub repo URL or owner/repo first.");
      return false;
    }

    setLoading(true);
    setError(null);
    setInstallUrl(null);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/github/repo-snapshot?repoUrl=${encodeURIComponent(trimmedRepo)}`
      );
      const payload = (await response.json()) as RepoSnapshot | FetchFailurePayload;

      if (!response.ok) {
        setResult(null);
        const fallbackInstallUrl =
          payload?.installUrl ||
          (payload?.appSlug
            ? `https://github.com/apps/${payload.appSlug}/installations/new`
            : null);
        setInstallUrl(fallbackInstallUrl);
        setError(payload?.error || "GitHub fetch failed.");
        return false;
      }

      setResult(payload as RepoSnapshot);
      return true;
    } catch (fetchError: unknown) {
      setResult(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Something went wrong while fetching the repository."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canFetch) {
      setError("Enter a GitHub repo URL or owner/repo first.");
      return;
    }

    await fetchRepoSnapshot(repoUrl);
  };

  const handleInstallClick = () => {
    if (!installUrl) {
      return;
    }

    const trimmedRepo = repoUrl.trim();
    if (!trimmedRepo) {
      setError("Enter a repo URL before starting install.");
      return;
    }

    try {
      window.sessionStorage.setItem(INSTALL_PENDING_REPO_KEY, trimmedRepo);
    } catch {
      // Ignore storage errors in private browsing modes.
    }

    let nextInstallUrl = installUrl;
    try {
      const installTarget = new URL(installUrl);
      const state = btoa(
        JSON.stringify({
          repoUrl: trimmedRepo,
          ts: Date.now(),
        })
      );
      installTarget.searchParams.set("state", state);
      nextInstallUrl = installTarget.toString();
    } catch {
      // Fallback to original URL if URL parsing fails.
    }

    window.location.href = nextInstallUrl;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupAction = params.get("setup_action");
    const installationId = params.get("installation_id");
    const stateRepo = decodeStateRepo(params.get("state"));

    if (!setupAction && !installationId) {
      return;
    }

    const storedRepo = (() => {
      try {
        return window.sessionStorage.getItem(INSTALL_PENDING_REPO_KEY);
      } catch {
        return null;
      }
    })();

    const repoFromCallback = stateRepo || storedRepo;

    if (setupAction === "request") {
      setStatusMessage(
        "Install request submitted. Ask the org owner to approve it, then retry fetch."
      );
    } else if (repoFromCallback) {
      setRepoUrl(repoFromCallback);
      setStatusMessage("Installation detected. Fetching repository data...");
      void fetchRepoSnapshot(repoFromCallback);
    }

    try {
      window.sessionStorage.removeItem(INSTALL_PENDING_REPO_KEY);
    } catch {
      // Ignore cleanup errors.
    }

    params.delete("setup_action");
    params.delete("installation_id");
    params.delete("state");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [fetchRepoSnapshot]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between border-b-2 border-border pb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase text-muted-foreground transition-colors hover:text-neon-green"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="font-display text-2xl font-extrabold uppercase">
            GitHub Repo Fetch Test
          </h1>
          <div className="w-16" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border-2 border-border bg-card p-4 md:p-6"
        >
          <label
            htmlFor="repo-url"
            className="block font-mono text-xs font-bold uppercase text-muted-foreground"
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
                "Fetch Repo Data"
              )}
            </button>
            <p className="font-mono text-xs text-muted-foreground">
              Requires this GitHub App to be installed on the target repository.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Set GitHub App Setup URL to: {window.location.origin}/add-repo
          </p>
        </form>

        {statusMessage && (
          <div className="border-2 border-neon-cyan bg-neon-cyan/10 px-4 py-3 font-mono text-sm text-neon-cyan">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="border-2 border-neon-red bg-neon-red/10 px-4 py-3 font-mono text-sm text-neon-red">
            {error}
          </div>
        )}

        {installUrl && (
          <div className="border-2 border-neon-amber bg-neon-amber/10 p-4">
            <p className="font-mono text-sm text-neon-amber">
              Install the GitHub App on this repo/account first, then click Fetch again.
            </p>
            <a
              href={installUrl}
              onClick={(event) => {
                event.preventDefault();
                handleInstallClick();
              }}
              className="mt-3 inline-flex border-2 border-neon-amber bg-background px-3 py-1 font-mono text-xs font-bold uppercase text-neon-amber hover:bg-neon-amber hover:text-background"
            >
              Install GitHub App and Return
            </a>
          </div>
        )}

        {result && (
          <div className="space-y-5">
            <section className="border-2 border-border bg-card p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-extrabold uppercase">
                    {result.repo.fullName}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {result.repo.description || "No description provided."}
                  </p>
                </div>
                <a
                  href={result.repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 border-2 border-border bg-background px-3 py-1 font-mono text-xs font-bold uppercase hover:border-neon-cyan hover:text-neon-cyan"
                >
                  Open on GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Default Branch</div>
                  <div className="mt-1 font-bold">{result.repo.defaultBranch}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Language</div>
                  <div className="mt-1 font-bold">{result.repo.language || "n/a"}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Stars</div>
                  <div className="mt-1 font-bold">{result.repo.stars}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Forks</div>
                  <div className="mt-1 font-bold">{result.repo.forks}</div>
                </div>
                <div className="border-2 border-border bg-background p-3 font-mono text-xs">
                  <div className="text-muted-foreground">Fetched At</div>
                  <div className="mt-1 font-bold">{formatDate(result.fetchedAt)}</div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="border-2 border-border bg-card p-4 md:p-6">
                <h3 className="mb-3 font-display text-lg font-extrabold uppercase">
                  Issues ({result.summary.issueCount})
                </h3>
                <div className="max-h-96 space-y-2 overflow-auto">
                  {result.issues.length === 0 && (
                    <p className="font-mono text-xs text-muted-foreground">No issues found.</p>
                  )}
                  {result.issues.map((issue) => (
                    <a
                      key={issue.id}
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-2 border-border bg-background p-3 hover:border-neon-cyan"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        #{issue.number} by {issue.user}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold">{issue.title}</div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        State: {issue.state} | Updated: {formatDate(issue.updatedAt)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="border-2 border-border bg-card p-4 md:p-6">
                <h3 className="mb-3 font-display text-lg font-extrabold uppercase">
                  Pull Requests ({result.summary.pullRequestCount})
                </h3>
                <div className="max-h-96 space-y-2 overflow-auto">
                  {result.pullRequests.length === 0 && (
                    <p className="font-mono text-xs text-muted-foreground">
                      No pull requests found.
                    </p>
                  )}
                  {result.pullRequests.map((pr) => (
                    <a
                      key={pr.id}
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-2 border-border bg-background p-3 hover:border-neon-green"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        #{pr.number} by {pr.user}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold">{pr.title}</div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        State: {pr.state}
                        {pr.draft ? " (draft)" : ""} | Updated: {formatDate(pr.updatedAt)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>

            <section className="border-2 border-border bg-card p-4 md:p-6">
              <h3 className="mb-3 font-display text-lg font-extrabold uppercase">
                Root Files ({result.summary.rootFileCount})
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.rootFiles.length === 0 && (
                  <p className="font-mono text-xs text-muted-foreground">No root files found.</p>
                )}
                {result.rootFiles.map((file) => (
                  <a
                    key={`${file.path}-${file.type}`}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border-2 border-border bg-background p-3 font-mono text-xs hover:border-neon-amber"
                  >
                    <div className="font-bold">{file.name}</div>
                    <div className="mt-1 text-muted-foreground">
                      {file.type} · {file.path}
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="border-2 border-border bg-card p-4 md:p-6">
              <h3 className="mb-2 font-display text-lg font-extrabold uppercase">
                Full File Tree Snapshot
              </h3>
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                {result.summary.treeEntryCount} entries
                {result.summary.treeTruncated ? " (truncated for safety)" : ""}
              </p>
              <div className="max-h-72 space-y-2 overflow-auto">
                {result.fileTree.slice(0, 120).map((entry) => (
                  <a
                    key={`${entry.sha}-${entry.path}`}
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block border-2 border-border bg-background p-2 font-mono text-xs hover:border-neon-cyan"
                  >
                    {entry.type} · {entry.path}
                  </a>
                ))}
                {result.fileTree.length === 0 && (
                  <p className="font-mono text-xs text-muted-foreground">
                    No tree entries available.
                  </p>
                )}
              </div>
            </section>

            <details className="border-2 border-border bg-card p-4">
              <summary className="cursor-pointer font-mono text-xs font-bold uppercase">
                Raw Payload (debug)
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto bg-background p-3 font-mono text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
