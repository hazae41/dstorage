import { Database } from "@/libs/indexeddb"
import { RpcRouter } from "@/libs/jsonrpc"
import { Future } from "@hazae41/future"
import { RpcCounter, RpcId, RpcRequest, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

const database = await Database.openOrThrow("keyval", 1)

const globalCounter = new RpcCounter()
const globalRequests = new Map<RpcId, RpcRequest<unknown>>()
const globalResponses = new Map<RpcId, Future<RpcResponse>>()

self.addEventListener("message", async (event) => {
  /**
   * iframe,page -> serviceWorker
   */
  if (event.origin !== location.origin)
    return

  const message = JSON.parse(event.data) as RpcRequestPreinit

  console.debug(`${event.origin} -> ${location.origin}/service_worker: ${event.data}`)

  /**
   * iframe -> serviceWorker
   */
  if (message.method === "connect") {
    const [pagePort] = event.ports

    if (pagePort == null)
      return

    const pageRouter = new RpcRouter(pagePort)

    pageRouter.handlers.set("global_request", async (request) => {
      const [origin] = request.params as [string]
      return globalRequests.get(origin)
    })

    pageRouter.handlers.set("global_respond", async (request) => {
      const [init] = request.params as [RpcResponseInit]
      const response = RpcResponse.from(init)
      globalResponses.get(response.id)?.resolve(response)
    })

    await pageRouter.hello()

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

    const originData = { kv: { allowed: false } }
    const originRouter = new RpcRouter(originPort)

    originRouter.handlers.set("kv_ask", async (request) => {
      const [name] = request.params as [string]

      const current = await database.getOrThrow(btoa(`${name}#${origin}`))

      if (current === true) {
        originData.kv.allowed = true
        return true
      }

      const globalRequest = globalCounter.prepare({ method: "kv_ask", params: [name, origin] })
      const globalResponse = new Future<RpcResponse>()

      try {
        globalRequests.set(globalRequest.id, globalRequest)
        globalResponses.set(globalRequest.id, globalResponse)

        const globalResult = await globalResponse.promise.then(r => r.unwrap())

        if (!globalResult)
          return false

        console.log("allowing", name, origin)

        await database.setOrThrow(btoa(`${name}#${origin}`), true)

        originData.kv.allowed = true
        return true
      } finally {
        // globalResponses.delete(globalId)
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

    await originRouter.hello()

    return
  }
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()