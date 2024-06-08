import { RpcRouter } from "@/libs/jsonrpc"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  const message = event.data as RpcRequestPreinit

  if (message.method === "connect") {
    const [originPort] = event.ports
    const originRouter = new RpcRouter(originPort)

    await originRouter.helloOrThrow(AbortSignal.timeout(1000))

    return
  }
})

self.skipWaiting()