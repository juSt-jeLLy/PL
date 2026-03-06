export type RepoSnapshot = {
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
  allFiles: Array<{
    name: string;
    path: string;
    type: string;
    size: number;
    url: string;
  }>;
  fetchedAt: string;
};

export type FetchFailurePayload = {
  error: string;
  notInstalled?: boolean;
  installUrl?: string;
  appSlug?: string;
};

export type SecurityFinding = {
  severity: string;
  type: string;
  title: string;
  description: string;
  file: string;
  line?: number;
};

export type CodeSuggestion = {
  priority: string;
  category: string;
  title: string;
  description: string;
  file: string;
  line?: number;
  example?: string;
};
