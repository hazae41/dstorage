import "@hazae41/symbol-dispose-polyfill";

import { RpcRequestPreinit } from "@hazae41/jsonrpc";

export { };

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

addEventListener("message", async (event) => {
  const message = event.data as RpcRequestPreinit

  if (message.method === "ping") {
    if (event.source == null)
      return
    event.source.postMessage({ method: "pong" }, { targetOrigin: event.origin })
    return
  }

  if (message.method === "connect2") {
    const [originPort] = event.ports

    if (originPort == null)
      return

    serviceWorker.postMessage({ method: "connect3", params: [event.origin] }, [originPort])
    return
  }
})