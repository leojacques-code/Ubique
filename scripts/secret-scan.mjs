import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const patterns = [
  ["OpenAI project key", /sk-proj-[A-Za-z0-9_-]{20,}/g],
  ["OpenAI legacy key", /sk-[A-Za-z0-9]{32,}/g],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/g],
  ["GitHub PAT", /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ["Private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const hits = [];
for (const file of files) {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 2_000_000) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [label, regex] of patterns) {
    regex.lastIndex = 0;
    if (regex.test(text)) hits.push({ file, label });
  }
}

if (hits.length) {
  console.error(
    "Potential committed secrets detected. Values are intentionally not printed.",
  );
  for (const hit of hits) console.error(`- ${hit.file}: ${hit.label}`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} tracked files checked).`);
