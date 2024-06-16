import { Future } from "@hazae41/future"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"
import { Signals } from "@hazae41/signals"

export class WindowMessenger {

  constructor(
    readonly window: Window,
    readonly origin: string
  ) { }

  async pingOrThrow(signal = Signals.never()) {
    const resolveOnPong = new Future<boolean>()
    using rejectOnAbort = Signals.rejectOnAbort(signal)

    const onMessage = (event: MessageEvent) => {
      if (event.source !== this.window)
        return
      if (event.origin !== this.origin)
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
        this.window.postMessage([{ method: "ping" }], this.origin)
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