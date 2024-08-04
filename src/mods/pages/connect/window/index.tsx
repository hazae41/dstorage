import "@hazae41/symbol-dispose-polyfill";

import { useBackgroundContext } from "@/mods/comps/background";
import { usePathContext } from "@hazae41/chemin";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";
import { useCallback, useEffect } from "react";

export function ConnectWindowPage() {
  const path = usePathContext().unwrap()
  const background = useBackgroundContext().unwrap()

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

      location.replace(path.go("/keepalive"))
      return
    }
  }, [path, background])

  useEffect(() => {
    addEventListener("message", onMessage)
    return () => removeEventListener("message", onMessage)
  }, [onMessage])

  return <>Loading...</>
}