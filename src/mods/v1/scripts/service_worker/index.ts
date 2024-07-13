import "@hazae41/symbol-dispose-polyfill";

import { RequestLike, ResponseLike, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { Kv } from "@/libs/storage";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";
import { Nullable } from "@hazae41/option";

export { };

declare const self: ServiceWorkerGlobalScope

declare const FILES_AND_HASHES: Nullable<[string, string][]>

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("meta"))
})

const filesAndHashes = typeof FILES_AND_HASHES !== "undefined"
  ? new Map(FILES_AND_HASHES)
  : new Map()

async function uncache(request: Request) {
  if (process.env.NODE_ENV === "development")
    return fetch(request)

  const url = new URL(request.url)

  if (!url.pathname.split("/").at(-1)!.includes("."))
    url.pathname += ".html"

  if (!filesAndHashes.has(url.pathname))
    return fetch(request)

  const cache = await caches.open("meta")

  /**
   * Check if already cached
   */
  if (request.cache !== "reload") {
    const cached = await cache.match(request)

    if (cached != null)
      return cached

    /**
     * Not found in cache
     */
  }

  /**
   * Fetch but get a fresh version
   */
  const fetched = await fetch(request, { cache: "reload" })

  /**
   * Errors are not verified nor cached
   */
  if (!fetched.ok)
    return fetched

  const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await fetched.clone().arrayBuffer()))
  const hashRawHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

  if (hashRawHex !== filesAndHashes.get(url.pathname))
    throw new Error("Invalid hash")

  cache.put(request, fetched.clone())

  return fetched
}

self.addEventListener("fetch", (event) => {
  event.respondWith(uncache(event.request))
})

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