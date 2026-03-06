export const BACKEND_URL = "http://localhost:3005";
export const ALLOWED_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".cpp", ".c", ".cs", ".rb", ".php", ".yaml", ".yml", ".json", ".sh"];
export const IGNORED_PATHS = ["node_modules/", ".git/", "dist/", "build/", "vendor/", "__pycache__/", ".next/", "coverage/"];

export function shouldIncludeFile(path: string, size?: number) {
  if (IGNORED_PATHS.some(ignored => path.includes(ignored))) return false;
  if (size && size > 500_000) return false; // Skip files > 500KB
  return ALLOWED_EXTENSIONS.some(ext => path.endsWith(ext));
}

export function chunkCode(content: string, filePath: string, chunkSize = 250) {
  const lines = content.split("\n");
  if (lines.length <= chunkSize) return [{ content, filePath, chunkIndex: 0, total: 1 }];
  
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push({
      content: lines.slice(i, i + chunkSize).join("\n"),
      filePath,
      chunkIndex: chunks.length,
      total: Math.ceil(lines.length / chunkSize)
    });
  }
  return chunks;
}

export async function fetchFileContent(owner: string, repo: string, path: string) {
  const res = await fetch(`${BACKEND_URL}/api/github/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
  const data = await res.json();
  return atob(data.content.replace(/\n/g, ""));
}
