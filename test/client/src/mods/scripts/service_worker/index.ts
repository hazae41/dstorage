import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";

export { };

declare const self: ServiceWorkerGlobalScope

let target: RpcRouter

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  const [message] = event.data as [RpcRequestPreinit]

  if (message.method === "ping") {
    if (event.source == null)
      return
    event.source.postMessage([{ method: "pong" }])
    return
  }

  if (message.method === "connect") {
    const [port] = event.ports

    if (port == null)
      return

    const router = new RpcRouter(port)

    router.handlers.set("proxy", async (request: RpcRequestPreinit, transferables: Transferable[]) => {
      const [subrequest] = request.params as [RpcRequestPreinit]

      if (target == null)
        throw new Error(`Not connected`)

      return await target.requestOrThrow(subrequest, transferables, AbortSignal.timeout(1000)).then(([r, t]) => [r.unwrap(), t])
    })

    await router.helloOrThrow(AbortSignal.timeout(1000))

    return
  }

  if (message.method === "connect3") {
    const [origin] = message.params as [string]

    if (origin == null)
      return

    const [port] = event.ports

    if (port == null)
      return

    const router = new RpcRouter(port)

    await router.helloOrThrow(AbortSignal.timeout(1000))

    target = router

    return
  }
})

console.log(4)