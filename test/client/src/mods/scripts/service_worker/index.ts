import { RpcRouter } from "@/libs/jsonrpc"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"

export { }

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

    const onRequest = async (request: RpcRequestPreinit) => {
      if (targetRouter == null)
        return
      return await targetRouter.requestOrThrow(request, [], AbortSignal.timeout(1000)).then(r => r.unwrap())
    }

    pageRouter.handlers.set("kv_set", onRequest)
    pageRouter.handlers.set("kv_get", onRequest)

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