import "@hazae41/symbol-dispose-polyfill";

import { RequestLike, ResponseLike, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";

export { };

declare const self: ServiceWorkerGlobalScope

declare const FILES_AND_HASHES: [string, string][]

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("meta"))
})

const filesAndHashes = new Map(FILES_AND_HASHES)

async function uncache(request: Request) {
  const cache = await caches.open("meta")
  const cached = await cache.match(request)

  if (cached != null)
    return cached

  const url = new URL(request.url)

  if (!filesAndHashes.has(url.pathname))
    throw new Error("Invalid path")

  const fetched = await fetch(request)
  const cloned = fetched.clone()
  const bytes = await cloned.arrayBuffer()

  const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  const hashRawHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

  if (hashRawHex !== filesAndHashes.get(url.pathname))
    throw new Error("Invalid hash")

  cache.put(request, fetched.clone())

  return fetched
}

// self.addEventListener("fetch", (event) => {
//   event.respondWith(uncache(event.request))
// })

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

    router.handlers.set("sw_size", async () => [await self.clients.matchAll().then(r => r.length)])

    router.handlers.set("kv_ask", async (request) => {
      const [scope, origin, capacity] = request.params as [string, string, number]

      if (scope === "meta")
        throw new Error("Not allowed")

      const cache = await caches.open(scope)

      const allowedUrl = new URL("/allowed", "http://meta")
      allowedUrl.searchParams.set("origin", origin)
      const allowedReq = new Request(allowedUrl)
      const allowedRes = new Response()

      await cache.put(allowedReq, allowedRes)

      const capacityUrl = new URL("/capacity", "http://meta")
      const capacityReq = new Request(capacityUrl)

      const oldCapacityRes = await cache.match(capacityReq)
      const oldCapacityNum = oldCapacityRes == null ? 0 : await oldCapacityRes.json() as number

      const newCapacityNum = capacity
      const newCapacityRes = new Response(JSON.stringify(newCapacityNum))

      if (newCapacityNum > oldCapacityNum)
        await cache.put(capacityReq, newCapacityRes)

      return [] as const
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

      router.handlers.set("kv_ask", async (request) => {
        const [scope] = request.params as [string]

        if (scope === "meta")
          throw new Error("Not allowed")

        const cache = await caches.open(scope)

        const allowedUrl = new URL("/allowed", "http://meta")
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        if (allowedRes == null)
          throw new Error("Not allowed")

        return []
      })

      router.handlers.set("kv_set", async (request) => {
        const [scope, req, res] = request.params as [string, RequestLike, ResponseLike]

        if (scope === "meta")
          throw new Error("Not allowed")

        const cache = await caches.open(scope)

        const valueReq = new Request(req.url, req)
        const valueUrl = new URL(valueReq.url)

        if (valueUrl.origin === "http://meta")
          throw new Error("Not allowed")

        const allowedUrl = new URL("/allowed", "http://meta")
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        if (allowedRes == null)
          throw new Error("Not allowed")

        const oldValueRes = await cache.match(valueReq)
        const oldValueSize = oldValueRes == null ? 0 : await oldValueRes.arrayBuffer().then(r => r.byteLength)

        const newValueRes = new Response(res.body, res)
        const newValueSize = await newValueRes.clone().arrayBuffer().then(r => r.byteLength)

        const sizeUrl = new URL("/size", "http://meta")
        const sizeReq = new Request(sizeUrl)

        const oldSizeRes = await cache.match(sizeReq)
        const oldSizeNum = oldSizeRes == null ? 0 : await oldSizeRes.json() as number

        const newSizeNum = oldSizeNum - oldValueSize + newValueSize

        const capacityUrl = new URL("/capacity", "http://meta")
        const capacityReq = new Request(capacityUrl)
        const capacityRes = await cache.match(capacityReq)
        const capacityNum = capacityRes == null ? 0 : await capacityRes.json() as number

        if (newSizeNum > capacityNum)
          throw new Error("Too big")

        await cache.put(valueReq, newValueRes)
        await cache.put(sizeReq, new Response(JSON.stringify(newSizeNum)))

        return []
      })

      router.handlers.set("kv_get", async (request) => {
        const [scope, req] = request.params as [string, RequestLike]

        if (scope === "meta")
          throw new Error("Not allowed")

        const cache = await caches.open(scope)

        const valueReq = new Request(req.url, req)
        const valueUrl = new URL(valueReq.url)

        if (valueUrl.origin === "http://meta")
          throw new Error("Not allowed")

        const allowedUrl = new URL("/allowed", "http://meta")
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        if (allowedRes == null)
          throw new Error("Not allowed")

        const valueRes = await cache.match(valueReq)

        if (valueRes == null)
          return []

        const transValueRes = TransferableResponse.from(valueRes)

        return [transValueRes.toJSON(), transValueRes.transferables]
      })

      await router.helloOrThrow(AbortSignal.timeout(1000))

      return
    }
  }
})

console.log(15)