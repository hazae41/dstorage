import "@hazae41/symbol-dispose-polyfill";

import { RequestLike, ResponseLike, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";

export { };

declare const self: ServiceWorkerGlobalScope

async function main() {
  self.addEventListener("install", async () => {
    /**
     * Perform some validations on the current service worker
     */

    const currentRes = await fetch(location.href, { cache: "force-cache" })
    const currentCacheControl = currentRes.headers.get("cache-control")

    if (currentCacheControl !== "public, max-age=31536000, immutable")
      throw new Error(`Current service worker is not properly cached`)

    const currentBytes = new Uint8Array(await currentRes.arrayBuffer())
    const currentHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", currentBytes))
    const currentHashRawHex = Array.from(currentHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    if (location.pathname !== `/service_worker.${currentHashRawHex}.js`)
      throw new Error(`Current service worker has been tampered`)

    await self.skipWaiting()
  })

  try {
    /**
     * Check for update
     */

    const latestRes = await fetch("/service_worker.js", { cache: "reload" })
    const latestBytes = new Uint8Array(await latestRes.arrayBuffer())
    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", latestBytes))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const updateUrl = new URL(`/service_worker.${latestHashRawHex}.js`, location.href)

    /**
     * Update available
     */
    if (updateUrl.href !== location.href) {
      /**
       * Perform some validations on the updated service worker
       */

      const updateRes = await fetch(updateUrl.href, { cache: "force-cache" })
      const updateCacheControl = updateRes.headers.get("cache-control")

      if (updateCacheControl !== "public, max-age=31536000, immutable")
        throw new Error(`Updated service worker is not properly cached`)

      const updateBytes = new Uint8Array(await updateRes.arrayBuffer())
      const updateHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", updateBytes))
      const updateHashRawHex = Array.from(updateHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

      if (updateUrl.pathname !== `/service_worker.${updateHashRawHex}.js`)
        throw new Error(`Updated service worker has been tampered`)

      /**
       * Update reference
       */

      const cache = await caches.open("service_worker")

      const req = new Request("/service_worker.js")
      const res = new Response(`/service_worker.${updateHashRawHex}.js`)

      await cache.put(req, res)

      /**
       * Reload to force update
       */

      await self.registration.unregister()

      const clients = await self.clients.matchAll({ type: "window" })

      for (const client of clients)
        client.navigate(client.url)

      return
    }
  } catch (e: unknown) {
    console.error(e)
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
      const [pagePort] = event.ports

      if (pagePort == null)
        return

      const pageRouter = new RpcRouter(pagePort)

      pageRouter.handlers.set("sw_size", async () => [await self.clients.matchAll().then(r => r.length)])

      pageRouter.handlers.set("kv_ask", async (request) => {
        const [scope, origin, capacity] = request.params as [string, string, number]

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

      await pageRouter.helloOrThrow(AbortSignal.timeout(1000))

      return
    }

    /**
     * (unknown ->) sameOrigin -> serviceWorker
     */
    if (message.method === "connect3") {
      const [origin] = message.params as [string]

      if (origin == null)
        return

      const [originPort] = event.ports

      if (originPort == null)
        return

      if (origin !== location.origin) {
        const originRouter = new RpcRouter(originPort)

        originRouter.handlers.set("kv_ask", async (request) => {
          const [scope] = request.params as [string]

          const cache = await caches.open(scope)

          const allowedUrl = new URL("/allowed", "http://meta")
          allowedUrl.searchParams.set("origin", origin)
          const allowedReq = new Request(allowedUrl)
          const allowedRes = await cache.match(allowedReq)

          if (allowedRes == null)
            throw new Error("Not allowed")

          return []
        })

        originRouter.handlers.set("kv_set", async (request) => {
          const [scope, req, res] = request.params as [string, RequestLike, ResponseLike]

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

        originRouter.handlers.set("kv_get", async (request) => {
          const [scope, req] = request.params as [string, RequestLike]

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

        await originRouter.helloOrThrow(AbortSignal.timeout(1000))

        return
      }
    }
  })
}

await main()