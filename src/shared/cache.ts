export type CacheEntry = {
  path: string;
  name: string;
  bytes: number;
  modified: string;
  projects: string[];
  clearable: boolean;
  reason: string;
};
