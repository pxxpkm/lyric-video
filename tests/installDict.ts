import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installDict } from "../src/core/s2t";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function installProjectDict(): void {
  installDict(
    readFileSync(join(root, "dict/STCharacters.txt"), "utf8"),
    readFileSync(join(root, "dict/STPhrases.txt"), "utf8"),
    readFileSync(join(root, "dict/HKVariants.txt"), "utf8"),
  );
}
