import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { walkSync } from "../libs/fs/index.js";

const filesAndHashes = new Map()

for (const absolute of walkSync("./out")) {
  const content = readFileSync(absolute)
  const relative = path.relative("./out", absolute)
  const hash = createHash("sha256").update(content).digest("hex")
  filesAndHashes.set(`/${relative}`, hash)
}

const manifest = JSON.stringify(filesAndHashes)

for (const absolute of walkSync("./out")) {
  if (absolute.endsWith(".js")) {
    const original = readFileSync(absolute, "utf8")
    const replaced = original.replaceAll("FILES_AND_HASHES", manifest)
    writeFileSync(absolute, replaced, "utf8")
  }
}