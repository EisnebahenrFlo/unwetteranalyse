#!/usr/bin/env node
/**
 * Fail-fast Check: keine Emojis in src/.
 * Erfasst übliche Emoji-Unicode-Bereiche (Misc Symbols, Dingbats,
 * Pictographs, Supplemental Symbols, Symbols & Pictographs Extended-A).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
const SKIP = new Set([".asset.json"]);
const EXT = /\.(ts|tsx|js|jsx|css|md|mdx|json|html|svg)$/;

const hits = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p);
      continue;
    }
    if (![...SKIP].every((sk) => !p.endsWith(sk))) continue;
    if (!EXT.test(p)) continue;
    const content = readFileSync(p, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (EMOJI.test(line)) {
        hits.push(`${relative(process.cwd(), p)}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}
walk(ROOT);

if (hits.length) {
  console.error("Emojis in src/ verboten:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("check:emoji ok – keine Emojis in src/");
