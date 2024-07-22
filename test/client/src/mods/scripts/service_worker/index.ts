import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { Immutable } from "@hazae41/immutable";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";
import { Nullable } from "@hazae41/option";

export { };

declare const self: ServiceWorkerGlobalScope

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

/**
 * Declare global macro
 */
declare function $raw$<T>(script: string): T

/**
 * Only cache on production
 */
if (process.env.NODE_ENV === "production") {
  /**
   * Use $raw$ to avoid minifiers from mangling the code
   */
  const files = $raw$<[string, string][]>(`$run$(async () => {
    const fs = await import("fs")
    const path = await import("path")
    const crypto = await import("crypto")
  
    function* walkSync(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name > b.name ? 1 : -1)
  
      for (const file of files) {
        if (file.isDirectory()) {
          yield* walkSync(path.join(dir, file.name))
        } else {
          yield path.join(dir, file.name)
        }
      }
    }
  
    const files = new Array()
  
    for (const absolute of walkSync("./out")) {
      const filename = path.basename(absolute)

      /**
       * Do not cache saumon files
       */
      if (filename.endsWith(".saumon.js"))
        continue
  
      /**
       * Do not cache service-workers
       */
      if (filename.startsWith("service_worker."))
        continue

      /**
       * Do not cache bootpages
       */
      if (fs.existsSync(\`./\${dirname}/_\${filename}\`))
        continue
      if (filename.endsWith(".html") && fs.existsSync(\`./\${dirname}/_\${filename.slice(0, -5)}/index.html\`))
        continue
      if (!filename.endsWith(".html") && fs.existsSync(\`./\${dirname}/_\${filename}/index\`))
        continue
  
      const text = fs.readFileSync(absolute)
      const hash = crypto.createHash("sha256").update(text).digest("hex")
  
      const relative = path.relative("./out", absolute)
  
      files.push([\`/\${relative}\`, hash])
    }
  
    return files
  }, { space: 0 })`)

  const cache = new Immutable.Cache(new Map(files))

  self.addEventListener("activate", (event) => {
    /**
     * Uncache previous version
     */
    event.waitUntil(cache.uncache())

    /**
     * Precache current version
     */
    event.waitUntil(cache.precache())
  })

  /**
   * Respond with cache
   */
  self.addEventListener("fetch", (event) => cache.handle(event))
}

let target: Nullable<RpcRouter> = undefined

self.addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  const [message] = event.data as [RpcRequestPreinit]

  if (message.method === "ping") {
    if (event.source == null)
      return
    event.source.postMessage([{ method: "pong" }])
    return
  }

  if (message.method === "connect") {
    const [port] = event.ports

    if (port == null)
      return

    const router = new RpcRouter(port)

    router.handlers.set("proxy", async (request: RpcRequestPreinit, transferables: Transferable[]) => {
      const [subrequest] = request.params as [RpcRequestPreinit]

      if (target == null)
        throw new Error(`Not connected`)

      return await target.requestOrThrow(subrequest, transferables, AbortSignal.timeout(1000)).then(([r, t]) => [r.unwrap(), t])
    })

    await router.helloOrThrow(AbortSignal.timeout(1000))

    return
  }

  if (message.method === "connect3") {
    const [origin] = message.params as [string]

    if (origin == null)
      return

    const [port] = event.ports

    if (port == null)
      return

    const router = new RpcRouter(port)

    await router.helloOrThrow(AbortSignal.timeout(1000))

    target = router

    target.resolveOnClose.promise.then(() => {
      if (target !== router)
        return
      target = undefined
    }).catch(() => { })

    return
  }
})

console.log(4)