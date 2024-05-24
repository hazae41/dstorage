import { RpcCounter } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

self.addEventListener("message", (event) => {
  console.log(location.origin, "service_worker", event.data)

  const [port] = event.ports

  const counter = new RpcCounter()

  port.addEventListener("message", (event) => {
    console.log(location.origin, "service_worker", event.data)
  })

  port.postMessage(JSON.stringify(counter.prepare({ method: "kv_ask", params: ["test"] })))

  port.start()
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()