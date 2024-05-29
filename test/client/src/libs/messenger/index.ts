import { Future } from "@hazae41/future"

export namespace Messenger {

  export async function hello(source: Window, origin: string, signal = new AbortController().signal) {
    const resolveOnPong = new Future<boolean>()

    const onMessage = (event: MessageEvent) => {
      if (event.source !== source)
        return
      if (event.data !== "pong")
        return
      resolveOnPong.resolve(true)
    }

    try {
      addEventListener("message", onMessage, { passive: true })

      while (!signal.aborted) {
        source.postMessage("ping", { targetOrigin: origin })
        const resolveOnTimeout = new Promise<boolean>(ok => setTimeout(ok, 100, false))
        const ponged = await Promise.race([resolveOnPong.promise, resolveOnTimeout])

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