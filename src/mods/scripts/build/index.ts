import { readFile, writeFile } from "fs/promises"

const serviceWorkerBytes = await readFile("./service_worker.js")
const serviceWorkerHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", serviceWorkerBytes))
const serviceWorkerHashRawHex = Buffer.from(serviceWorkerHashBytes).toString("hex")

await writeFile(`./service_worker.${serviceWorkerHashRawHex}.js`, serviceWorkerBytes)