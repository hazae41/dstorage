import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";

export { };

declare const self: ServiceWorkerGlobalScope

const uuid = crypto.randomUUID()

self.addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  const message = event.data as RpcRequestPreinit

  console.log(uuid, message)

  /**
   * sameOrigin -> serviceWorker
   */
  if (message.method === "connect") {
    const [pagePort] = event.ports

    if (pagePort == null)
      return

    const pageRouter = new RpcRouter(pagePort)

    pageRouter.handlers.set("sw_size", () => self.clients.matchAll().then(r => r.length))

    pageRouter.handlers.set("kv_ask", async (request) => {
      const [scope, origin, capacity] = request.params as [string, string, number]

      const cache = await caches.open(scope)

      const allowedUrl = new URL("/allowed", location.origin)
      allowedUrl.searchParams.set("origin", origin)
      const allowedReq = new Request(allowedUrl)
      const allowedRes = new Response()

      console.log(uuid, "ask", allowedUrl.toString(), allowedRes)

      await cache.put(allowedReq, allowedRes)

      const capacityUrl = new URL("/capacity", location.origin)
      const capacityReq = new Request(capacityUrl)

      const oldCapacityRes = await cache.match(capacityReq)
      const oldCapacityNum = oldCapacityRes == null ? 0 : await oldCapacityRes.json() as number

      const newCapacityNum = capacity
      const newCapacityRes = new Response(JSON.stringify(newCapacityNum))

      if (newCapacityNum > oldCapacityNum)
        await cache.put(capacityReq, newCapacityRes)

      return
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

        const allowedUrl = new URL("/allowed", location.origin)
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        console.log(uuid, "ask", allowedUrl.toString(), allowedRes)

        if (allowedRes == null)
          throw new Error("Not allowed")

        return
      })

      originRouter.handlers.set("kv_set", async (request) => {
        const [scope, key, body, init] = request.params as [string, string, BodyInit, ResponseInit]

        const cache = await caches.open(scope)

        const allowedUrl = new URL("/allowed", location.origin)
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        console.log(uuid, "set", allowedUrl.toString(), allowedRes)

        if (allowedRes == null)
          throw new Error("Not allowed")

        const valueUrl = new URL("/value", location.origin)
        valueUrl.searchParams.set("key", key)
        const valueReq = new Request(valueUrl)

        const oldValueRes = await cache.match(valueReq)
        const oldValueSize = oldValueRes == null ? 0 : await oldValueRes.arrayBuffer().then(r => r.byteLength)

        const newValueRes = new Response(body, init)
        const newValueSize = await newValueRes.clone().arrayBuffer().then(r => r.byteLength)

        const sizeUrl = new URL("/size", location.origin)
        const sizeReq = new Request(sizeUrl)

        const oldSizeRes = await cache.match(sizeReq)
        const oldSizeNum = oldSizeRes == null ? 0 : await oldSizeRes.json() as number

        const newSizeNum = oldSizeNum - oldValueSize + newValueSize

        const capacityUrl = new URL("/capacity", location.origin)
        const capacityReq = new Request(capacityUrl)
        const capacityRes = await cache.match(capacityReq)
        const capacityNum = capacityRes == null ? 0 : await capacityRes.json() as number

        if (newSizeNum > capacityNum)
          throw new Error("Too big")

        await cache.put(valueReq, newValueRes)
        await cache.put(sizeReq, new Response(JSON.stringify(newSizeNum)))
      })

      originRouter.handlers.set("kv_get", async (request) => {
        const [scope, key] = request.params as [string, string]

        const cache = await caches.open(scope)

        const allowedUrl = new URL("/allowed", location.origin)
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        console.log(uuid, "get", allowedUrl.toString(), allowedRes)

        if (allowedRes == null)
          throw new Error("Not allowed")

        const valueUrl = new URL("/value", location.origin)
        valueUrl.searchParams.set("key", key)
        const valueReq = new Request(valueUrl)
        const valueRes = await cache.match(valueReq)

        if (valueRes == null)
          throw new Error("Not found")

        return valueRes
      })

      await originRouter.helloOrThrow(AbortSignal.timeout(1000))

      return
    }
  }
})

self.skipWaiting()