import { RpcRouter } from "@/libs/jsonrpc"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

const cache = await caches.open("cache")

self.addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  const message = event.data as RpcRequestPreinit

  /**
   * iframe -> serviceWorker
   */
  if (message.method === "connect") {
    const [pagePort] = event.ports

    if (pagePort == null)
      return

    const pageRouter = new RpcRouter(pagePort)

    pageRouter.handlers.set("kv_ask", async (request) => {
      const [scope, origin, capacity] = request.params as [string, string, number]

      const allowedUrl = new URL("/allowed", scope)
      allowedUrl.searchParams.set("origin", origin)
      const allowedReq = new Request(allowedUrl)
      const allowedRes = new Response()

      await cache.put(allowedReq, allowedRes)

      const capacityUrl = new URL("/capacity", scope)
      const capacityReq = new Request(capacityUrl)
      const capacityRes = new Response(JSON.stringify(capacity))

      await cache.put(capacityReq, capacityRes)
    })

    await pageRouter.helloOrThrow(AbortSignal.timeout(1000))

    return
  }

  /**
   * (crossOrigin ->) iframe -> serviceWorker
   */
  if (message.method === "connect3") {
    const [origin] = message.params as [string]

    if (origin == null)
      return

    const [originPort] = event.ports

    if (originPort == null)
      return

    const originRouter = new RpcRouter(originPort)

    originRouter.handlers.set("kv_set", async (request) => {
      const [scope, key, value] = request.params as [string, string, BodyInit]

      const allowedUrl = new URL("/allowed", scope)
      allowedUrl.searchParams.set("origin", origin)
      const allowedReq = new Request(allowedUrl)
      const allowedRes = await cache.match(allowedReq)

      if (allowedRes == null)
        throw new Error("Not allowed")

      const capacityUrl = new URL("/capacity", scope)
      const capacityReq = new Request(capacityUrl)
      const capacityRes = await cache.match(capacityReq)
      const capacityNum = capacityRes == null ? 0 : await capacityRes.json() as number

      const sizeUrl = new URL("/size", scope)
      const sizeReq = new Request(sizeUrl)
      const sizeRes = await cache.match(sizeReq)
      const sizeNum = sizeRes == null ? 0 : await sizeRes.json() as number

      const valueUrl = new URL("/value", scope)
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

      const allowedUrl = new URL("/allowed", scope)
      allowedUrl.searchParams.set("origin", origin)
      const allowedReq = new Request(allowedUrl)
      const allowedRes = await cache.match(allowedReq)

      if (allowedRes == null)
        throw new Error("Not allowed")

      const valueUrl = new URL("/value", scope)
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
})

self.skipWaiting()