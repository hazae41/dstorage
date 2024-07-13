import "@hazae41/symbol-dispose-polyfill";

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

    if (message.method === "connect2") {
      const [port] = event.ports

      if (port == null)
        return

      background.worker.postMessage([{ method: "connect3", params: [event.origin] }], [port])

      const clients = await background.router.requestOrThrow<Client[]>({
        method: "sw_clients"
      }).then(([r]) => r.unwrap())

      if (clients.length > 1)
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