import { AlertCircle } from "lucide-react";

interface AnalysisLogsProps {
  logs: string[];
  isAnalyzing: boolean;
}

export function AnalysisLogs({ logs, isAnalyzing }: AnalysisLogsProps) {
  return (
    <section className="border-2 border-border bg-card p-4 md:p-6">
      <h3 className="mb-3 font-display text-lg font-extrabold uppercase flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-neon-amber" />
        Analysis Logs
      </h3>
      <div className="max-h-96 space-y-1 overflow-auto border-2 border-border bg-background p-3">
        {logs.length === 0 && !isAnalyzing && (
          <div className="font-mono text-xs text-muted-foreground">
            Click "Run Security Analysis" to start analyzing the repository...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="font-mono text-xs">
            {log}
          </div>
        ))}
        {isAnalyzing && (
          <div className="font-mono text-xs text-neon-cyan animate-pulse">
            🔄 Analysis in progress...
          </div>
        )}
      </div>
    </section>
  );
}
