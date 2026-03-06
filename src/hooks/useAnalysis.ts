import { useState, useCallback } from "react";
import { SecurityFinding, CodeSuggestion } from "../types/repo";
import { shouldIncludeFile, chunkCode, fetchFileContent } from "../utils/repoUtils";
import { analyzeChunkWithAI, suggestImprovementsWithAI } from "../services/aiAnalysis";

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([]);
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);

  const addAnalysisLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setAnalysisLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const runSecurityAnalysis = useCallback(async (owner: string, repo: string, files: any[]) => {
    setIsAnalyzing(true);
    setAnalysisLogs([]);
    setSecurityFindings([]);
    setCodeSuggestions([]);

    addAnalysisLog("🚀 Starting security analysis...");
    
    try {
      const codeFiles = files.filter(file => 
        file.type === "file" && shouldIncludeFile(file.path, file.size)
      );

      addAnalysisLog(`📁 Found ${codeFiles.length} code files to analyze`);
      
      const maxFiles = 5; // Limit for free tier
      const filesToAnalyze = codeFiles.slice(0, maxFiles);
      
      if (codeFiles.length > maxFiles) {
        addAnalysisLog(`⚠️  Limiting analysis to ${maxFiles} files (free tier)`);
      }

      let totalFindings: SecurityFinding[] = [];
      let totalSuggestions: CodeSuggestion[] = [];

      for (let i = 0; i < filesToAnalyze.length; i++) {
        const file = filesToAnalyze[i];
        addAnalysisLog(`📄 Fetching (${i + 1}/${maxFiles}): ${file.path}`);
        const content = await fetchFileContent(owner, repo, file.path);
        
        if (!content || content.length > 10000) {
          addAnalysisLog(`⚠️  Skipping ${file.path} (too large or empty)`);
          continue;
        }

        const chunks = chunkCode(content, file.path);
        addAnalysisLog(`🔍 Analyzing ${chunks.length} chunks in ${file.path}`);

        for (const chunk of chunks) {
          try {
            // Security analysis
            addAnalysisLog(`🔒 Security scan: ${file.path} (chunk ${chunk.chunkIndex + 1})`);
            const findings = await analyzeChunkWithAI(chunk);
            totalFindings.push(...findings);

            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Code suggestions
            addAnalysisLog(`💡 Suggestions: ${file.path} (chunk ${chunk.chunkIndex + 1})`);
            const suggestions = await suggestImprovementsWithAI(chunk);
            totalSuggestions.push(...suggestions);

            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            addAnalysisLog(`❌ Error analyzing ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      setSecurityFindings(totalFindings);
      setCodeSuggestions(totalSuggestions);
      addAnalysisLog(`✅ Analysis complete! Found ${totalFindings.length} security issues and ${totalSuggestions.length} suggestions`);

    } catch (error) {
      addAnalysisLog(`❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addAnalysisLog]);

  return {
    isAnalyzing,
    analysisLogs,
    securityFindings,
    codeSuggestions,
    runSecurityAnalysis
  };
}
