import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Source scanner behind spendScan.test.ts. It looks for the entry points that
// cost money (DataForSEO client, usage metering, the three paid workflows and
// the OpenRouter chat model) and reports which server functions and MCP tools
// reach them, so a new paid handler cannot slip past the gate unlisted.

export const root = resolve(__dirname, "../../..");

export const PAID_MARKERS = [
  "createDataforseoClient",
  "meterDataforseoCall",
  "SITE_AUDIT_WORKFLOW",
  "RANK_CHECK_WORKFLOW",
  "AI_VISIBILITY_WORKFLOW",
  "buildChatAgentModel",
];

const markerPattern = new RegExp(`\\b(${PAID_MARKERS.join("|")})\\b`);
const MAX_DEPTH = 3;

const read = (file: string) => readFileSync(file, "utf8");

export function listSources(dir: string): string[] {
  return readdirSync(resolve(root, dir))
    .filter((name) => name.endsWith(".ts") && !name.includes(".test."))
    .map((name) => `${dir}/${name}`);
}

function resolveModule(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? resolve(root, "src", spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(resolve(root, from)), spec)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate)) return candidate.slice(root.length + 1);
  }
  return null;
}

const importPattern = /(?:from\s+|import\(\s*|import\s+)["']([^"']+)["']/g;

/** Every module `file` imports, static or dynamic, that exists in the repo. */
function importsOf(file: string): string[] {
  const out: string[] = [];
  for (const match of read(resolve(root, file)).matchAll(importPattern)) {
    const target = resolveModule(file, match[1]);
    if (target) out.push(target);
  }
  return out;
}

const memo = new Map<string, boolean>();

/** True when `file`, or a module it reaches within MAX_DEPTH, names a marker. */
export function reachesPaid(file: string, depth = 0): boolean {
  const key = `${file}@${depth}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  memo.set(key, false);
  let result = markerPattern.test(read(resolve(root, file)));
  if (!result && depth < MAX_DEPTH) {
    result = importsOf(file).some((dep) => reachesPaid(dep, depth + 1));
  }
  memo.set(key, result);
  return result;
}

/** Server functions in `file` whose handler uses an import that reaches paid work. */
export function paidServerFunctions(file: string): string[] {
  const source = read(resolve(root, file));
  const imported = new Map<string, string>();
  for (const match of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g,
  )) {
    const target = resolveModule(file, match[2]);
    if (!target) continue;
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop();
      if (name) imported.set(name, target);
    }
  }
  const names: string[] = [];
  const declarations = [
    ...source.matchAll(/export const (\w+) = createServerFn/g),
  ];
  declarations.forEach((match, index) => {
    const end = declarations[index + 1]?.index ?? source.length;
    const body = source.slice(match.index, end);
    const direct = markerPattern.test(body);
    const viaImport = [...imported].some(
      ([name, target]) =>
        new RegExp(`\\b${name}\\b`).test(body) && reachesPaid(target),
    );
    if (direct || viaImport) names.push(match[1]);
  });
  return names;
}

/** MCP tool names in `file`; the whole file is judged by its imports. */
export function mcpToolsInFile(file: string): {
  names: string[];
  paid: boolean;
} {
  const source = read(resolve(root, file));
  return {
    names: [...source.matchAll(/^\s+name: "([a-z_]+)",/gm)].map((m) => m[1]),
    paid: reachesPaid(file),
  };
}
