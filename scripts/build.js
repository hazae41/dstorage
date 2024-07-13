const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

function* walkSync(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(dir, file.name))
    } else {
      yield path.join(dir, file.name)
    }
  }
}

const filesAndHashes = new Array()

for (const absolute of walkSync("./out")) {
  if (absolute.endsWith("service_worker.js"))
    continue

  const text = fs.readFileSync(absolute)
  const hash = crypto.createHash("sha256").update(text).digest("hex")

  const relative = path.relative("./out", absolute)

  filesAndHashes.push([`/${relative}`, hash])
}

const manifest = JSON.stringify(filesAndHashes)

for (const absolute of walkSync("./out")) {
  if (absolute.endsWith("service_worker.js"))
    continue
  if (!absolute.endsWith(".js"))
    continue

  const original = fs.readFileSync(absolute, "utf8")
  const replaced = original.replaceAll("FILES_AND_HASHES", manifest)

  fs.writeFileSync(absolute, replaced, "utf8")
}