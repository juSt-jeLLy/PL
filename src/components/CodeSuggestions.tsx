import { useState } from "react";
import { ChevronDown, ChevronRight, Zap, Code, CheckCircle, Layers, BookOpen, TestTube, Eye } from "lucide-react";
import { CodeSuggestion } from "../types/repo";
import { getPriorityColor } from "../utils/uiHelpers";

interface CodeSuggestionsProps {
  suggestions: CodeSuggestion[];
}

export function CodeSuggestions({ suggestions }: CodeSuggestionsProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [suggestionFilter, setSuggestionFilter] = useState("ALL");

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Architecture": return <Layers className="h-4 w-4" />;
      case "Readability": return <BookOpen className="h-4 w-4" />;
      case "Testing": return <TestTube className="h-4 w-4" />;
      case "Edge Case": return <Eye className="h-4 w-4" />;
      case "Better Approach": return <Zap className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const filteredSuggestions = suggestionFilter === "ALL" 
    ? suggestions 
    : suggestions.filter(s => s.category === suggestionFilter);

  return (
    <section className="border-2 border-border bg-card p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-extrabold uppercase flex items-center gap-2">
          <Zap className="h-5 w-5 text-neon-cyan" />
          Improvements ({filteredSuggestions.length})
        </h3>
        <div className="flex items-center gap-2">
          <select 
            value={suggestionFilter} 
            onChange={(e) => setSuggestionFilter(e.target.value)}
            className="border-2 border-border bg-background px-2 py-1 font-mono text-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="Architecture">Architecture</option>
            <option value="Readability">Readability</option>
            <option value="Testing">Testing</option>
            <option value="Edge Case">Edge Cases</option>
            <option value="Better Approach">Better Approach</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-auto">
        {filteredSuggestions.length === 0 && suggestionFilter === "ALL" && (
          <div className="border-2 border-blue-500 bg-blue-500/10 p-6 text-center rounded-lg">
            <CheckCircle className="h-12 w-12 text-blue-400 mx-auto mb-3" />
            <div className="font-mono text-lg font-bold text-blue-400">✨ Code Looks Great!</div>
            <div className="mt-2 font-mono text-sm text-muted-foreground">No improvement suggestions at this time</div>
          </div>
        )}
        
        {filteredSuggestions.length === 0 && suggestionFilter !== "ALL" && (
          <div className="border-2 border-border bg-background p-4 text-center rounded-lg">
            <div className="font-mono text-sm text-muted-foreground">No {suggestionFilter.toLowerCase()} suggestions found</div>
          </div>
        )}
        
        {filteredSuggestions.map((suggestion, i) => {
          const isExpanded = expandedSuggestion === i;
          return (
            <div key={i} className={`brutal-card ${getPriorityColor(suggestion.priority)} transition-all duration-200 hover:shadow-lg cursor-pointer`}>
              <div 
                onClick={() => setExpandedSuggestion(isExpanded ? null : i)}
                className="p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(suggestion.category)}
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-1 bg-current/20 rounded">
                          {suggestion.priority}
                        </span>
                        <span className="font-mono text-xs bg-neon-cyan/20 text-neon-cyan px-2 py-1 rounded">
                          {suggestion.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-mono text-sm font-bold mb-1">{suggestion.title}</h4>
                      <div className="font-mono text-xs opacity-70 flex items-center gap-2">
                        <Code className="h-3 w-3" />
                        {suggestion.file}{suggestion.line ? `:${suggestion.line}` : ""}
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
                      <h5 className="font-mono text-xs font-bold mb-2 opacity-70">DESCRIPTION</h5>
                      <p className="font-mono text-xs leading-relaxed">{suggestion.description}</p>
                    </div>
                    
                    {suggestion.example && (
                      <div className="border-t border-current/20 pt-3">
                        <h5 className="font-mono text-xs font-bold mb-2 opacity-70 flex items-center gap-1">
                          <Code className="h-3 w-3" />
                          CODE EXAMPLE
                        </h5>
                        <div className="bg-background border border-current/30 rounded overflow-hidden">
                          <div className="bg-current/10 px-3 py-1 border-b border-current/20">
                            <span className="font-mono text-xs opacity-70">Suggested Implementation</span>
                          </div>
                          <pre className="p-3 font-mono text-xs overflow-auto bg-background/50">
                            <code>{suggestion.example}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-mono opacity-70">Impact:</span>
                        <div className="flex">
                          {[1,2,3,4,5].map(star => (
                            <div key={star} className={`w-3 h-3 ${star <= (suggestion.priority === "HIGH" ? 5 : suggestion.priority === "MEDIUM" ? 3 : 1) ? "bg-current" : "bg-current/20"} mr-1 rounded-sm`} />
                          ))}
                        </div>
                      </div>
                      <button className="font-mono text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded hover:bg-blue-500/30 transition-colors ml-auto">
                        Apply Suggestion
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
