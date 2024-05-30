import { RpcRequestPreinit } from "@hazae41/jsonrpc"

export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

addEventListener("message", async (event) => {
  if (event.origin === location.origin)
    return
  if (typeof event.data !== "string")
    return
  const message = JSON.parse(event.data) as RpcRequestPreinit

  console.debug(`${event.origin} -> ${location.origin}/iframe: ${event.data}`)

  if (message.method === "ping") {
    if (event.source == null)
      return
    event.source.postMessage(JSON.stringify({ method: "pong" }), { targetOrigin: event.origin })
    return
  }

  if (message.method === "connect2") {
    const [originPort] = event.ports

    if (originPort == null)
      return

    serviceWorker.postMessage(JSON.stringify({ method: "connect3", params: [event.origin] }), [originPort])
    return
  }
})

console.log(location.origin, "iframe", "started")