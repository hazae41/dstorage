import { Database } from "@/libs/indexeddb"
import { Future } from "@hazae41/future"
import { RpcCounter, RpcErr, RpcError, RpcId, RpcOk, RpcRequest, RpcRequestInit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc"

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

      const originCounter = new RpcCounter()
      const originRequests = new Map<RpcId, Future<RpcResponse>>()

      const onOriginRequest = async (request: RpcRequest<unknown>) => {
        if (request.method === "kv_ask") {
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

            const iframeRequest = iframeCounter.prepare({ method: "open", params: [url] })
            const iframeFuture = new Future<RpcResponse>()

            try {
              iframeRequests.set(iframeRequest.id, iframeFuture)

              iframePort.postMessage(JSON.stringify(iframeRequest))
              await iframeFuture.promise.then(r => r.unwrap())
            } finally {
              iframeRequests.delete(iframeRequest.id)
            }

            const globalResult = await globalFuture.promise.then(r => r.unwrap())

            if (!globalResult)
              return false

            await database.setOrThrow(btoa(`${name}#${origin}`), true)

            originData.kv.allowed = true
            return true
          } finally {
            globalRequests.delete(globalId)
          }
        }

        if (request.method === "kv_set") {
          const [name, key, value] = request.params as [string, string, unknown]

          if (!originData.kv.allowed)
            throw new Error("Not allowed")

          await database.setOrThrow(`${name}#${key}`, value)

          return
        }

        if (request.method === "kv_get") {
          const [name, key] = request.params as [string, string]

          if (!originData.kv.allowed)
            throw new Error("Not allowed")

          const value = await database.getOrThrow(`${name}#${key}`)

          return value
        }
      }

      originPort.addEventListener("message", async (event) => {
        if (typeof event.data !== "string")
          return
        const requestOrResponse = JSON.parse(event.data) as RpcRequestInit | RpcResponseInit

        if (typeof requestOrResponse !== "object")
          return

        if ("method" in requestOrResponse) {
          const request = RpcRequest.from(requestOrResponse)

          try {
            const result = await onOriginRequest(request)
            const response = new RpcOk(request.id, result)
            const data = JSON.stringify(response)

            originPort.postMessage(data)
            return
          } catch (e: unknown) {
            const error = RpcError.rewrap(e)
            const response = new RpcErr(request.id, error)
            const data = JSON.stringify(response)

            originPort.postMessage(data)
            return
          }
        } else {
          const response = RpcResponse.from(requestOrResponse)

          originRequests.get(response.id)?.resolve(response)
          return
        }
      })

      originPort.start()

      const iframeCounter = new RpcCounter()
      const iframeRequests = new Map<RpcId, Future<RpcResponse>>()

      const onIframeRequest = async (request: RpcRequest<unknown>) => {
        /**
         * NOOP
         */
      }

      iframePort.addEventListener("message", async (event) => {
        if (typeof event.data !== "string")
          return
        const requestOrResponse = JSON.parse(event.data) as RpcRequestInit | RpcResponseInit

        if (typeof requestOrResponse !== "object")
          return

        if ("method" in requestOrResponse) {
          const request = RpcRequest.from(requestOrResponse)

          try {
            const result = await onIframeRequest(request)
            const response = new RpcOk(request.id, result)
            const data = JSON.stringify(response)

            iframePort.postMessage(data)
            return
          } catch (e: unknown) {
            const error = RpcError.rewrap(e)
            const response = new RpcErr(request.id, error)
            const data = JSON.stringify(response)

            iframePort.postMessage(data)
            return
          }
        } else {
          const response = RpcResponse.from(requestOrResponse)

          iframeRequests.get(response.id)?.resolve(response)
          return
        }
      })

      iframePort.start()
      return
    }

    /**
     * page -> serviceWorker
     */
    if (origin === location.origin) {
      const [pagePort] = event.ports

      if (pagePort == null)
        return

      const pageCounter = new RpcCounter()
      const pageRequests = new Map<RpcId, Future<RpcResponse>>()

      const onPageRequest = async (request: RpcRequest<unknown>) => {
        if (request.method === "global_respond") {
          const [init] = request.params as [RpcResponseInit]
          const response = RpcResponse.from(init)

          globalRequests.get(response.id)?.resolve(response)
          return
        }
      }

      pagePort.addEventListener("message", async (event) => {
        if (typeof event.data !== "string")
          return
        const requestOrResponse = JSON.parse(event.data) as RpcRequestInit | RpcResponseInit

        if (typeof requestOrResponse !== "object")
          return

        if ("method" in requestOrResponse) {
          const request = RpcRequest.from(requestOrResponse)

          try {
            const result = await onPageRequest(request)
            const response = new RpcOk(request.id, result)
            const data = JSON.stringify(response)

            pagePort.postMessage(data)
            return
          } catch (e: unknown) {
            const error = RpcError.rewrap(e)
            const response = new RpcErr(request.id, error)
            const data = JSON.stringify(response)

            pagePort.postMessage(data)
            return
          }
        } else {
          const response = RpcResponse.from(requestOrResponse)

          pageRequests.get(response.id)?.resolve(response)
          return
        }
      })

      pagePort.start()
      return
    }
  }
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()