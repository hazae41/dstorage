import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";

export { };

declare const self: ServiceWorkerGlobalScope

let targetRouter: RpcRouter

addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  const message = event.data as RpcRequestPreinit

  if (message.method === "connect") {
    const [pagePort] = event.ports

    if (pagePort == null)
      return

    const pageRouter = new RpcRouter(pagePort)

    pageRouter.handlers.set("proxy", async (request: RpcRequestPreinit) => {
      const [subrequest, transferables] = request.params as [RpcRequestPreinit, Transferable[]]

      if (targetRouter == null)
        throw new Error(`Not connected`)

      return await targetRouter.requestOrThrow(subrequest, transferables, AbortSignal.timeout(1000)).then(r => r.unwrap())
    })

    await pageRouter.helloOrThrow(AbortSignal.timeout(1000))

    return
  }

  if (message.method === "connect3") {
    const [origin] = message.params as [string]

    if (origin == null)
      return

    const [originPort] = event.ports

    if (originPort == null)
      return

    const originRouter = new RpcRouter(originPort)

    await originRouter.helloOrThrow(AbortSignal.timeout(1000))

    targetRouter = originRouter
    return
  }
})

self.skipWaiting()