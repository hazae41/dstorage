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

declare const FILES: [string, string][]

if (process.env.NODE_ENV === "production") {
  const cache = new Immutable.Cache(new Map(FILES))

  self.addEventListener("activate", (event) => {
    event.waitUntil(cache.uncache())
    event.waitUntil(cache.precache())
  })

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