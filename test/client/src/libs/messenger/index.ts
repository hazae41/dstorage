import { Future } from "@hazae41/future"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"
import { Signals } from "@hazae41/signals"

export namespace Messenger {

  export async function pingOrThrow(target: Window, origin: string, signal = new AbortController().signal) {
    const resolveOrPong = new Future<boolean>()
    using rejectOnAbort = Signals.rejectOnAbort(signal)

    const onMessage = (event: MessageEvent) => {
      if (event.source !== target)
        return
      if (event.origin !== origin)
        return
      if (typeof event.data !== "string")
        return
      const message = JSON.parse(event.data) as RpcRequestPreinit

      if (message.method === "pong") {
        resolveOrPong.resolve(true)
        return
      }
    }

    try {
      addEventListener("message", onMessage, { passive: true })

      while (!signal.aborted) {
        target.postMessage(JSON.stringify({ method: "ping" }), { targetOrigin: origin })
        const resolveOnTimeout = new Promise<boolean>(ok => setTimeout(ok, 100, false))
        const ponged = await Promise.race([resolveOrPong.promise, resolveOnTimeout, rejectOnAbort.get()])

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