import { Database } from "@/libs/indexeddb"
import { Future } from "@hazae41/future"
import { RpcCounter, RpcErr, RpcError, RpcId, RpcOk, RpcRequest, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

const counter = new RpcCounter()

const database = await Database.openOrThrow("keyval", 1)
const requests = new Map<RpcId, Future<RpcResponse>>()

self.addEventListener("message", (event) => {
  if (event.origin !== location.origin)
    return

  console.log(location.origin, "service_worker", event.data)

  const origin = event.data
  const [port] = event.ports

  if (origin === location.origin) {
    const onRequest2 = async (request: RpcRequest<unknown>) => {
      if (request.method === "respond") {
        const [init] = request.params as [RpcResponseInit]

        const response = RpcResponse.from(init)
        const future = requests.get(response.id)

        future?.resolve(response)
        return
      }
    }

    const onRequest = async (request: RpcRequest<unknown>) => {
      try {
        return new RpcOk(request.id, await onRequest2(request))
      } catch (e: unknown) {
        return new RpcErr(request.id, RpcError.rewrap(e))
      }
    }

    port.addEventListener("message", async (event) => {
      const request = RpcRequest.from(JSON.parse(event.data))
      const response = await onRequest(request)
      port.postMessage(JSON.stringify(response))
    })

    port.start()
    return
  }

  if (origin !== location.origin) {
    const metadata = { kv: { allowed: false } }

    const onRequest2 = async (request: RpcRequest<unknown>) => {
      if (request.method === "kv_ask") {
        const [name] = request.params as [string]

        const current = await database.getOrThrow(btoa(`${name}#${origin}`))

        if (current === true) {
          metadata.kv.allowed = true
          return true
        } else {
          const id = counter.id++
          const future = new Future<RpcResponse>()

          try {
            requests.set(id, future)

            await self.clients.openWindow(`/#/kv_ask?id=${id}&name=${name}&origin=${origin}`)

            const result = await future.promise.then(r => r.unwrap())

            if (!result)
              return false

            await database.setOrThrow(btoa(`${name}#${origin}`), true)

            metadata.kv.allowed = true
            return true
          } finally {
            requests.delete(id)
          }
        }
      }

      if (request.method === "kv_set") {
        const [name, key, value] = request.params as [string, string, unknown]

        if (!metadata.kv.allowed)
          throw new Error("Not allowed")

        await database.setOrThrow(`${name}#${key}`, value)

        return
      }

      if (request.method === "kv_get") {
        const [name, key] = request.params as [string, string]

        if (!metadata.kv.allowed)
          throw new Error("Not allowed")

        const value = await database.getOrThrow(`${name}#${key}`)

        return value
      }
    }

    const onRequest = async (request: RpcRequest<unknown>) => {
      try {
        return new RpcOk(request.id, await onRequest2(request))
      } catch (e: unknown) {
        return new RpcErr(request.id, RpcError.rewrap(e))
      }
    }

    port.addEventListener("message", async (event) => {
      const request = RpcRequest.from(JSON.parse(event.data))
      const response = await onRequest(request)
      port.postMessage(JSON.stringify(response))
    })

    port.start()
    return
  }
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()