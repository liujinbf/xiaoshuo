import { execFileSync, spawnSync } from "node:child_process";

const JS_EXT_RE = /\.(?:js|mjs|cjs)$/;

function gitFiles(args) {
  const output = execFileSync("git", args, { encoding: "utf-8" });
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const files = Array.from(new Set([
  ...gitFiles(["ls-files"]),
  ...gitFiles(["ls-files", "--others", "--exclude-standard"])
])).filter((file) => JS_EXT_RE.test(file));

const failed = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf-8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    failed.push(file);
    process.stderr.write(`\n[语法检查失败] ${file}\n`);
    process.stderr.write(result.stderr || result.stdout || "");
  }
}

if (failed.length > 0) {
  process.stderr.write(`\n共有 ${failed.length} 个文件未通过语法检查。\n`);
  process.exit(1);
}

console.log(`语法检查通过：${files.length} 个脚本文件。`);
