import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { WindowMessenger } from "@/libs/messenger";
import { useBackgroundContext } from "@/mods/comps/background";
import { useCallback, useEffect, useState } from "react";

const TARGET = "https://stereo-acc-station-formula.trycloudflare.com"

export default function Home() {
  const background = useBackgroundContext()

  const [connected, setConnected] = useState(false)

  const pingOrThrow = useCallback(async () => {
    while (!background.closed) {
      try {
        await background.requestOrThrow<boolean>({
          method: "proxy",
          params: [{ method: "hello" }]
        }).then(r => r.unwrap())

        setConnected(true)
      } catch (e: unknown) {
        setConnected(false)
      } finally {
        await new Promise(ok => setTimeout(ok, 1000))
      }
    }
  }, [background])

  useEffect(() => {
    pingOrThrow().catch(console.error)
  }, [pingOrThrow])

  const connectOrThrow = useCallback(async () => {
    if (connected)
      return

    const channel = new MessageChannel()
    const window = open(`${TARGET}/connect`, "_blank", "width=100,height=100")

    if (window == null)
      return

    const windowMessenger = new WindowMessenger(window, TARGET)

    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    await windowMessenger.pingOrThrow()

    window.postMessage({ method: "connect2" }, TARGET, [channel.port1])
    serviceWorker.postMessage({ method: "connect3", params: [TARGET] }, [channel.port2])
  }, [connected])

  const onConnectClick = useCallback(async () => {
    connectOrThrow()
  }, [connectOrThrow])

  const onAskClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()
      const window = open(`${TARGET}/request`, "_blank", "width=100,height=100")

      if (window == null)
        return

      const windowMessenger = new WindowMessenger(window, TARGET)
      const windowRouter = new RpcRouter(channel.port1)

      await windowMessenger.pingOrThrow()

      window.postMessage({ method: "connect" }, TARGET, [channel.port2])

      await windowRouter.helloOrThrow(AbortSignal.timeout(1000))

      await windowRouter.requestOrThrow<void>({
        method: "kv_ask",
        params: ["example", 5_000_000],
      }, [], AbortSignal.timeout(60_000)).then(r => r.unwrap())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  const onSetClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()

      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      const backgroundRouter = new RpcRouter(channel.port1)

      serviceWorker.postMessage({ method: "connect" }, [channel.port2])

      await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

      await backgroundRouter.requestOrThrow<void>({
        method: "proxy",
        params: [{
          method: "kv_set",
          params: ["example", "buffer", new Uint8Array([1, 2, 3, 4, 5]), { status: 200 }],
        }]
      }).then(r => r.unwrap())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  const onGetClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()

      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      const backgroundRouter = new RpcRouter(channel.port1)

      serviceWorker.postMessage({ method: "connect" }, [channel.port2])

      await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

      const response = await backgroundRouter.requestOrThrow<{}>({
        method: "proxy",
        params: [{
          method: "kv_get",
          params: ["example", "buffer"],
        }]
      }).then(r => r.unwrap())

      console.log(response)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  return <main className="">
    <button className="w-full"
      onClick={onAskClick}>
      Ask permission
    </button>
    {!connected &&
      <button className="w-full"
        onClick={onConnectClick}>
        Connect
      </button>}
    {connected && <>
      <button className="w-full"
        onClick={onSetClick}>
        Set value
      </button>
      <button className="w-full"
        onClick={onGetClick}>
        Get value
      </button>
    </>}
  </main>
}
