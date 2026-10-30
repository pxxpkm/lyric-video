export type CacheEntry = {
  path: string;
  name: string;
  bytes: number;
  modified: string;
  projects: string[];
  projectLinks: { projectPath: string; label: string }[];
  clearable: boolean;
  reason: string;
};
