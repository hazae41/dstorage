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
   * (unknown ->) sameOrigin -> serviceWorker
   */
  if (message.method === "connect3") {
    const [origin] = message.params as [string]

    if (origin == null)
      return

    const [originPort] = event.ports

    if (originPort == null)
      return

    /**
     * (sameOrigin ->) sameOrigin -> serviceWorker
     */
    if (origin === location.origin) {
      const originRouter = new RpcRouter(originPort)

      originRouter.handlers.set("kv_ask", async (request) => {
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
        const capacityRes = new Response(JSON.stringify(capacity))

        await cache.put(capacityReq, capacityRes)
      })

      await originRouter.helloOrThrow(AbortSignal.timeout(1000))

      return
    }

    if (origin !== location.origin) {
      const originRouter = new RpcRouter(originPort)

      originRouter.handlers.set("kv_set", async (request) => {
        const [scope, key, value] = request.params as [string, string, BodyInit]

        const cache = await caches.open(scope)

        const allowedUrl = new URL("/allowed", location.origin)
        allowedUrl.searchParams.set("origin", origin)
        const allowedReq = new Request(allowedUrl)
        const allowedRes = await cache.match(allowedReq)

        console.log(uuid, "set", allowedUrl.toString(), allowedRes)

        if (allowedRes == null)
          throw new Error("Not allowed")

        const capacityUrl = new URL("/capacity", location.origin)
        const capacityReq = new Request(capacityUrl)
        const capacityRes = await cache.match(capacityReq)
        const capacityNum = capacityRes == null ? 0 : await capacityRes.json() as number

        const sizeUrl = new URL("/size", location.origin)
        const sizeReq = new Request(sizeUrl)
        const sizeRes = await cache.match(sizeReq)
        const sizeNum = sizeRes == null ? 0 : await sizeRes.json() as number

        const valueUrl = new URL("/value", location.origin)
        valueUrl.searchParams.set("key", key)
        const valueReq = new Request(valueUrl)
        const valueRes = await cache.match(valueReq)
        const valueSize = valueRes == null ? 0 : await valueRes.arrayBuffer().then(r => r.byteLength)

        const newValueRes = new Response(value)
        const newValueRes2 = newValueRes.clone()
        const newValueSize = await newValueRes2.arrayBuffer().then(r => r.byteLength)

        const newSizeNum = sizeNum - valueSize + newValueSize

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

        console.log("get", allowedUrl.toString(), allowedRes)

        if (allowedRes == null)
          throw new Error("Not allowed")

        const valueUrl = new URL("/value", location.origin)
        valueUrl.searchParams.set("key", key)
        const valueReq = new Request(valueUrl)
        const valueRes = await cache.match(valueReq)

        if (valueRes == null)
          throw new Error("Not found")

        return await valueRes.arrayBuffer()
      })

      await originRouter.helloOrThrow(AbortSignal.timeout(1000))

      return
    }
  }
})

// self.skipWaiting()