import { Future } from "@hazae41/future"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"

export namespace Messenger {

  export async function ping(target: Window, origin: string, signal = new AbortController().signal) {
    const resolveOnPingOrPong = new Future<boolean>()

    const onMessage = (event: MessageEvent) => {
      if (event.source !== target)
        return
      if (event.origin !== origin)
        return
      const message = JSON.parse(event.data) as RpcRequestPreinit

      if (message.method === "ping") {
        resolveOnPingOrPong.resolve(true)
        return
      }

      if (message.method === "pong") {
        resolveOnPingOrPong.resolve(true)
        return
      }
    }

    try {
      addEventListener("message", onMessage, { passive: true })

      while (!signal.aborted) {
        target.postMessage(JSON.stringify({ method: "ping" }), { targetOrigin: origin })
        const resolveOnTimeout = new Promise<boolean>(ok => setTimeout(ok, 100, false))
        const ponged = await Promise.race([resolveOnPingOrPong.promise, resolveOnTimeout])

        if (ponged)
          return
        continue
      }

      signal.throwIfAborted()
    } finally {
      removeEventListener("message", onMessage)
    }
  }

}