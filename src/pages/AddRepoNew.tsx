import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { RepoSnapshot, FetchFailurePayload } from "../types/repo";
import { RepositoryForm } from "../components/RepositoryForm";
import { RepositoryDetails } from "../components/RepositoryDetails";
import { SecurityFindings } from "../components/SecurityFindings";
import { CodeSuggestions } from "../components/CodeSuggestions";
import { AnalysisLogs } from "../components/AnalysisLogs";
import { useAnalysis } from "../hooks/useAnalysis";

export default function AddRepo() {
  return <AddRepoContent />;
}

export function AddRepoContent({ embedded = false }: { embedded?: boolean }) {
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const {
    isAnalyzing,
    analysisLogs,
    securityFindings,
    codeSuggestions,
    runSecurityAnalysis
  } = useAnalysis();

  const canFetch = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);

  const redirectToInstall = useCallback((installUrl: string, repoUrl: string) => {
    const timeout = setTimeout(() => {
      window.open(installUrl, "_blank");
    }, 3000);

    const handleFocus = () => {
      clearTimeout(timeout);
      setStatusMessage("Welcome back! Try fetching the repository again.");
      window.removeEventListener("focus", handleFocus);
    };

    window.addEventListener("focus", handleFocus);
  }, []);

  const handleAnalysis = useCallback(async () => {
    if (!result) return;
    
    const [owner, repo] = result.repo.fullName.split("/");
    await runSecurityAnalysis(owner, repo, result.allFiles);
  }, [result, runSecurityAnalysis]);

  const fetchRepoSnapshot = useCallback(async (rawRepo: string) => {
    const trimmedRepo = rawRepo.trim();
    if (!trimmedRepo) {
      setError("Enter a GitHub repo URL or owner/repo first.");
      return false;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/github/repo-snapshot?repoUrl=${encodeURIComponent(trimmedRepo)}`
      );
      const payload = (await response.json()) as RepoSnapshot | FetchFailurePayload;

      if (!response.ok) {
        setResult(null);
        const fallbackInstallUrl =
          (payload as any)?.installUrl ||
          ((payload as any)?.appSlug
            ? `https://github.com/apps/${(payload as any).appSlug}/installations/new`
            : null);

        if ((payload as any)?.notInstalled && fallbackInstallUrl) {
          setStatusMessage("GitHub App not installed. Redirecting to install page...");
          redirectToInstall(fallbackInstallUrl, trimmedRepo);
          return false;
        }

        setError((payload as any)?.error || "GitHub fetch failed.");
        return false;
      }

      setResult(payload as RepoSnapshot);
      setStatusMessage(null);
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
  }, [redirectToInstall]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canFetch) {
      setError("Enter a GitHub repo URL or owner/repo first.");
      return;
    }
    await fetchRepoSnapshot(repoUrl);
  };

  const handleDirectInstallClick = async () => {
    if (!result) return;

    const appSlug = "your-github-app-slug"; // Replace with actual app slug
    const installUrl = `https://github.com/apps/${appSlug}/installations/new`;

    setStatusMessage(
      "Install request submitted. Ask the org owner to approve it, then retry fetch."
    );

    setTimeout(() => {
      window.open(installUrl, "_blank");
    }, 1000);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const repoFromUrl = urlParams.get("repo");
    if (repoFromUrl && !result) {
      setRepoUrl(repoFromUrl);
      fetchRepoSnapshot(repoFromUrl);
    }
  }, [fetchRepoSnapshot, result]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!embedded && (
        <header className="border-b-2 border-border bg-card p-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-mono text-sm hover:text-neon-green"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-7xl p-4">
        <div className="space-y-6">
          <RepositoryForm
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            loading={loading}
            canFetch={canFetch}
            onSubmit={handleSubmit}
            error={error}
            statusMessage={statusMessage}
          />

          {result && (
            <>
              <RepositoryDetails
                result={result}
                isAnalyzing={isAnalyzing}
                onRunAnalysis={handleAnalysis}
              />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <AnalysisLogs logs={analysisLogs} isAnalyzing={isAnalyzing} />
                <SecurityFindings findings={securityFindings} />
                <CodeSuggestions suggestions={codeSuggestions} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
