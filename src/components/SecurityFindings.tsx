import { useState } from "react";
import { ChevronDown, ChevronRight, Bug, Lock, Zap, Eye, Code, CheckCircle } from "lucide-react";
import { SecurityFinding } from "../types/repo";
import { getSeverityColor } from "../utils/uiHelpers";

interface SecurityFindingsProps {
  findings: SecurityFinding[];
}

export function SecurityFindings({ findings }: SecurityFindingsProps) {
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [findingFilter, setFindingFilter] = useState("ALL");

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <Bug className="h-4 w-4" />;
      case "HIGH": return <Lock className="h-4 w-4" />;
      case "MEDIUM": return <Zap className="h-4 w-4" />;
      case "LOW": return <Eye className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const filteredFindings = findingFilter === "ALL" 
    ? findings 
    : findings.filter(f => f.severity === findingFilter);

  return (
    <section className="border-2 border-border bg-card p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-extrabold uppercase flex items-center gap-2">
          <Lock className="h-5 w-5 text-red-400" />
          Security Issues ({filteredFindings.length})
        </h3>
        <div className="flex items-center gap-2">
          <select 
            value={findingFilter} 
            onChange={(e) => setFindingFilter(e.target.value)}
            className="border-2 border-border bg-background px-2 py-1 font-mono text-xs"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-auto">
        {filteredFindings.length === 0 && findingFilter === "ALL" && (
          <div className="border-2 border-green-500 bg-green-500/10 p-6 text-center rounded-lg">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <div className="font-mono text-lg font-bold text-green-400">🎉 No Security Issues Found!</div>
            <div className="mt-2 font-mono text-sm text-muted-foreground">Your code looks secure</div>
          </div>
        )}
        
        {filteredFindings.length === 0 && findingFilter !== "ALL" && (
          <div className="border-2 border-border bg-background p-4 text-center rounded-lg">
            <div className="font-mono text-sm text-muted-foreground">No {findingFilter.toLowerCase()} severity issues found</div>
          </div>
        )}
        
        {filteredFindings.map((finding, i) => {
          const isExpanded = expandedFinding === i;
          return (
            <div key={i} className={`brutal-card ${getSeverityColor(finding.severity)} transition-all duration-200 hover:shadow-lg cursor-pointer`}>
              <div 
                onClick={() => setExpandedFinding(isExpanded ? null : i)}
                className="p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(finding.severity)}
                      <span className="font-mono text-xs font-bold px-2 py-1 bg-current/20 rounded">
                        {finding.severity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-mono text-sm font-bold mb-1">{finding.title}</h4>
                      <div className="font-mono text-xs opacity-70 flex items-center gap-2">
                        <Code className="h-3 w-3" />
                        {finding.file}{finding.line ? `:${finding.line}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="ml-2">
                    {isExpanded ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                    <div className="border-t border-current/20 pt-3">
                      <h5 className="font-mono text-xs font-bold mb-2 opacity-70">VULNERABILITY TYPE</h5>
                      <span className="font-mono text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                        {finding.type}
                      </span>
                    </div>
                    
                    <div className="border-t border-current/20 pt-3">
                      <h5 className="font-mono text-xs font-bold mb-2 opacity-70">DESCRIPTION</h5>
                      <p className="font-mono text-xs leading-relaxed">{finding.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-mono opacity-70">Risk Level:</span>
                        <div className="flex">
                          {[1,2,3,4,5].map(star => (
                            <div key={star} className={`w-3 h-3 ${star <= (finding.severity === "CRITICAL" ? 5 : finding.severity === "HIGH" ? 4 : finding.severity === "MEDIUM" ? 3 : 2) ? "bg-current" : "bg-current/20"} mr-1 rounded-sm`} />
                          ))}
                        </div>
                      </div>
                      <button className="font-mono text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded hover:bg-red-500/30 transition-colors ml-auto">
                        Mark as Fixed
                      </button>
                      <button className="font-mono text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30 px-3 py-1 rounded hover:bg-gray-500/30 transition-colors">
                        Ignore
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
