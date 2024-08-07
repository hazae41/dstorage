import "@hazae41/symbol-dispose-polyfill";

import { RequestLike, ResponseLike, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { Kv } from "@/libs/storage";
import { Immutable } from "@hazae41/immutable";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";

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

  /**
   * sameOrigin -> serviceWorker
   */
  if (message.method === "connect") {
    const [port] = event.ports

    if (port == null)
      return

    const router = new RpcRouter(port)

    router.handlers.set("sw_clients", async () => {
      const clients = await self.clients.matchAll()
      const clients2 = clients.map(({ id, type, url, frameType }) => ({ id, type, url, frameType }))

      return [clients2]
    })

    await router.helloOrThrow(AbortSignal.timeout(1000))

    return
  }

  /**
   * (unknown ->) sameOrigin -> serviceWorker
   */
  if (message.method === "connect3") {
    const [origin] = message.params as [string]

    if (origin == null)
      return

    const [port] = event.ports

    if (port == null)
      return

    if (origin !== location.origin) {
      const router = new RpcRouter(port)

      router.handlers.set("kv_ask", async (rpcreq) => {
        const [scope] = rpcreq.params as [string]

        await Kv.ask(caches, origin, scope)

        return []
      })

      router.handlers.set("kv_set", async (rpcreq) => {
        const [scope, reqlike, reslike] = rpcreq.params as [string, RequestLike, ResponseLike]

        const request = new Request(reqlike.url, reqlike)
        const response = new Response(reslike.body, reslike)

        await Kv.set(caches, origin, scope, request, response)

        return []
      })

      router.handlers.set("kv_get", async (rpcreq) => {
        const [scope, reqlike] = rpcreq.params as [string, RequestLike]

        const request = new Request(reqlike.url, reqlike)
        const response = await Kv.get(caches, origin, scope, request)

        if (response == null)
          return []

        const reslike = TransferableResponse.from(response)

        return [reslike.toJSON(), reslike.transferables]
      })

      await router.helloOrThrow(AbortSignal.timeout(1000))

      return
    }
  }
})