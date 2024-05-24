import { Future } from "@hazae41/future"
import { RpcCounter, RpcId, RpcResponse } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

self.addEventListener("message", (event) => {
  console.log(location.origin, "service_worker", event.data)

  const [originPort] = event.ports

  const originCounter = new RpcCounter()
  const originRequests = new Map<RpcId, Future<RpcResponse>>()

  originPort.addEventListener("message", (event) => {
    console.log(location.origin, "service_worker", event.data)
  })

  originPort.postMessage(JSON.stringify(originCounter.prepare({ method: "kv_ask", params: ["test"] })))
  originPort.start()
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()