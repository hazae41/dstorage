import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { useBackgroundContext } from "@/mods/comps/background";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";
import { useCallback, useEffect } from "react";

export default function Home() {
  const background = useBackgroundContext()

  const onMessage = useCallback(async (event: MessageEvent) => {
    if (event.origin === location.origin)
      return
    const [message] = event.data as [RpcRequestPreinit]

    if (message.method === "ping") {
      if (event.source == null)
        return
      event.source.postMessage([{ method: "pong" }], { targetOrigin: event.origin })
      return
    }

    if (message.method === "connect") {
      const [pagePort] = event.ports

      if (pagePort == null)
        return

      const pageRouter = new RpcRouter(pagePort)

      pageRouter.handlers.set("sw_update_check", () => [background.update != null])
      pageRouter.handlers.set("sw_update_allow", () => [void background.update?.()])

      await pageRouter.helloOrThrow(AbortSignal.timeout(1000))

      return
    }

    if (message.method === "connect2") {
      const [parentPort] = event.ports

      if (parentPort == null)
        return

      const serviceWorker = navigator.serviceWorker.controller!

      serviceWorker.postMessage([{ method: "connect3", params: [event.origin] }], [parentPort])

      const size = await background.router.requestOrThrow<number>({ method: "sw_size" }).then(([r]) => r.unwrap())

      if (size > 1)
        close()

      location.assign("/keepalive")
      return
    }
  }, [background])

  useEffect(() => {
    addEventListener("message", onMessage)
    return () => removeEventListener("message", onMessage)
  }, [onMessage])

  return <>Loading...</>
}