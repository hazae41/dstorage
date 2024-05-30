import { RpcRouter } from "@/libs/jsonrpc"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"

export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

addEventListener("message", async (event) => {
  if (event.origin !== location.origin)
    return
  if (typeof event.data !== "string")
    return
  const message = JSON.parse(event.data) as RpcRequestPreinit

  if (message.method === "connect") {
    const [originPort] = event.ports
    const originRouter = new RpcRouter(originPort)

    await originRouter.helloOrThrow()

    return
  }
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()