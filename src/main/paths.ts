import { join } from "node:path";

let studio = () => join(process.cwd(), "studio-data");
let resources = () => process.cwd();

export function setRoots(next: { studio: () => string; resources: () => string }): void {
  studio = next.studio;
  resources = next.resources;
}

export function studioRoot(): string {
  return studio();
}

export function resourceRoot(): string {
  return resources();
}
