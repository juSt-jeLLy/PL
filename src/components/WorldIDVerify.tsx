import { useWorldID } from "@/hooks/useWorldID";
import { Button } from "@/components/ui/button";

export default function WorldIDVerify() {
  const { status, connectUrl, result, error, startVerification, reset } = useWorldID();

  return (
    <div className="flex flex-col items-center gap-6 p-8 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">Verify with World ID</h2>

      {status === "idle" && (
        <Button onClick={startVerification} className="w-full">
          Start Verification
        </Button>
      )}

      {status === "loading" && (
        <p className="text-muted-foreground animate-pulse">
          Generating verification request...
        </p>
      )}

      {status === "waiting" && connectUrl && (
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm text-muted-foreground text-center">
            Open this link on your phone in the <strong>World App</strong>
            {" "}(or paste into the{" "}
            <a
              href="https://simulator.worldcoin.org"
              target="_blank"
              rel="noreferrer"
              className="underline text-primary"
            >
              simulator
            </a>
            ):
          </p>

          {/* Deep link button for mobile */}
          <a
            href={connectUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full"
          >
            <Button variant="outline" className="w-full break-all text-xs">
              Open World App →
            </Button>
          </a>

          {/* Raw URL for copy/paste */}
          <code className="text-xs bg-muted rounded p-2 w-full break-all">
            {connectUrl}
          </code>

          <p className="text-sm text-muted-foreground animate-pulse">
            ⏳ Waiting for you to complete verification on mobile...
          </p>
        </div>
      )}

      {status === "verifying" && (
        <p className="text-muted-foreground animate-pulse">
          Proof received, verifying on server...
        </p>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="text-green-500 text-5xl">✅</div>
          <p className="font-semibold text-green-600">Verified successfully!</p>
          <pre className="text-xs bg-muted rounded p-4 w-full overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
          <Button variant="outline" onClick={reset}>Verify Again</Button>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="text-red-500 text-5xl">❌</div>
          <p className="text-red-500 text-sm text-center">{error}</p>
          <Button variant="outline" onClick={reset}>Try Again</Button>
        </div>
      )}
    </div>
  );
}