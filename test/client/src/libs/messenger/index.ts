import { Future } from "@hazae41/future"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"
import { Signals } from "@hazae41/signals"

export namespace WindowMessenger {

  export async function pingOrThrow(window: Window, origin: string, signal = Signals.never()) {
    const resolveOnPong = new Future<boolean>()
    using rejectOnAbort = Signals.rejectOnAbort(signal)

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window)
        return
      if (event.origin !== origin)
        return
      const [message] = event.data as [RpcRequestPreinit]

      if (message.method === "pong") {
        resolveOnPong.resolve(true)
        return
      }
    }

    try {
      addEventListener("message", onMessage, { passive: true })

      while (!signal.aborted) {
        window.postMessage([{ method: "ping" }], origin)
        const resolveOnTimeout = new Promise<boolean>(ok => setTimeout(ok, 100, false))
        const ponged = await Promise.race([resolveOnPong.promise, resolveOnTimeout, rejectOnAbort.get()])

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