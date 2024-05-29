import { Database } from "@/libs/indexeddb"
import { RpcRouter } from "@/libs/jsonrpc"
import { Future } from "@hazae41/future"
import { RpcCounter, RpcId, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

const database = await Database.openOrThrow("keyval", 1)

const globalCounter = new RpcCounter()
const globalRequests = new Map<RpcId, Future<RpcResponse>>()

self.addEventListener("message", async (event) => {
  console.debug(`${event.origin} -> ${location.origin}/service_worker: ${event.data}`)

  /**
   * iframe,page -> serviceWorker
   */
  if (event.origin === location.origin) {
    const origin = event.data

    /**
     * (crossOrigin ->) iframe -> serviceWorker
     */
    if (origin !== location.origin) {
      const [originPort, iframePort] = event.ports

      if (originPort == null)
        return
      if (iframePort == null)
        return
      const originData = { kv: { allowed: false } }
      const originRouter = new RpcRouter(originPort)
      const iframeRouter = new RpcRouter(iframePort)

      originRouter.handlers.set("kv_ask", async (request) => {
        const [name] = request.params as [string]

        const current = await database.getOrThrow(btoa(`${name}#${origin}`))

        if (current === true) {
          originData.kv.allowed = true
          return true
        }

        const globalId = globalCounter.id++
        const globalFuture = new Future<RpcResponse>()

        try {
          globalRequests.set(globalId, globalFuture)

          const url = `/#/kv_ask?id=${globalId}&name=${name}&origin=${origin}`
          await iframeRouter.request({ method: "open", params: [url] }).await().then(r => r.unwrap())

          const globalResult = await globalFuture.promise.then(r => r.unwrap())

          if (!globalResult)
            return false

          console.log("allowing", name, origin)

          await database.setOrThrow(btoa(`${name}#${origin}`), true)

          originData.kv.allowed = true
          return true
        } finally {
          globalRequests.delete(globalId)
        }
      })

      originRouter.handlers.set("kv_set", async (request) => {
        const [name, key, value] = request.params as [string, string, unknown]

        if (!originData.kv.allowed)
          throw new Error("Not allowed")

        await database.setOrThrow(`${name}#${key}`, value)

        return
      })

      originRouter.handlers.set("kv_get", async (request) => {
        const [name, key] = request.params as [string, string]

        if (!originData.kv.allowed)
          throw new Error("Not allowed")

        const value = await database.getOrThrow(`${name}#${key}`)

        return value
      })

      const originHello = originRouter.hello()
      originPort.start()
      await originHello

      const iframeHello = iframeRouter.hello()
      iframePort.start()
      await iframeHello

      return
    }

    /**
     * page -> serviceWorker
     */
    if (origin === location.origin) {
      const [pagePort] = event.ports

      if (pagePort == null)
        return

      const pageRouter = new RpcRouter(pagePort)

      pageRouter.handlers.set("global_respond", async (request) => {
        const [init] = request.params as [RpcResponseInit]
        const response = RpcResponse.from(init)
        globalRequests.get(response.id)?.resolve(response)
        return
      })

      const pageHello = pageRouter.hello()
      pagePort.start()
      await pageHello

      return
    }
  }
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()