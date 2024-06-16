import "@hazae41/symbol-dispose-polyfill";

import { ResponseLike, TransferableRequest, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { WindowMessenger } from "@/libs/messenger";
import { useBackgroundContext } from "@/mods/comps/background";
import { useCallback, useEffect, useState } from "react";

const TARGET = new URL("https://developed-costumes-thru-provided.trycloudflare.com")

export default function Home() {
  const background = useBackgroundContext()

  const [connected, setConnected] = useState(false)

  const pingOrThrow = useCallback(async () => {
    while (!background.closed) {
      try {
        await background.requestOrThrow<boolean>({
          method: "proxy",
          params: [{ method: "hello" }]
        }).then(([r]) => r.unwrap())

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
    const window = open(`${TARGET.origin}/connect`, "_blank", "width=100,height=100")

    if (window == null)
      return

    const windowMessenger = new WindowMessenger(window, TARGET.origin)

    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    await windowMessenger.pingOrThrow()

    window.postMessage([{ method: "connect2" }], TARGET.origin, [channel.port1])
    serviceWorker.postMessage([{ method: "connect3", params: [TARGET.origin] }], [channel.port2])
  }, [connected])

  const onConnectClick = useCallback(async () => {
    connectOrThrow()
  }, [connectOrThrow])

  const onAskClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()
      const window = open(`${TARGET.origin}/request`, "_blank")

      if (window == null)
        return

      const windowMessenger = new WindowMessenger(window, TARGET.origin)
      const windowRouter = new RpcRouter(channel.port1)

      await windowMessenger.pingOrThrow()

      window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

      await windowRouter.helloOrThrow(AbortSignal.timeout(1000))

      await windowRouter.requestOrThrow<void>({
        method: "kv_ask",
        params: ["example", 5_000_000],
      }, [], AbortSignal.timeout(60_000)).then(([r]) => r.unwrap())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  const setOrThrow = useCallback(async (scope: string, req: TransferableRequest, res: TransferableResponse) => {
    const channel = new MessageChannel()

    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const backgroundRouter = new RpcRouter(channel.port1)

    serviceWorker.postMessage([{ method: "connect" }], [channel.port2])

    await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

    await backgroundRouter.requestOrThrow<void>({
      method: "proxy",
      params: [{
        method: "kv_set",
        params: [scope, req.toJSON(), res.toJSON()],
      }]
    }, [...req.transferables, ...res.transferables]).then(([r]) => r.unwrap())
  }, [])

  const onSetClick = useCallback(async () => {
    try {
      const req = new TransferableRequest("https://example.com/test")
      const res = new TransferableResponse(new Uint8Array([1, 2, 3, 4, 5]), { status: 400 })
      await setOrThrow("example", req, res)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [setOrThrow])

  const getOrThrow = useCallback(async (scope: string, req: TransferableRequest) => {
    const channel = new MessageChannel()

    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const backgroundRouter = new RpcRouter(channel.port1)

    serviceWorker.postMessage([{ method: "connect" }], [channel.port2])

    await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

    const res = await backgroundRouter.requestOrThrow<ResponseLike>({
      method: "proxy",
      params: [{
        method: "kv_get",
        params: [scope, req.toJSON()],
      }]
    }, req.transferables).then(([r]) => r.unwrap())

    return new Response(res.body, res)
  }, [])

  const onGetClick = useCallback(async () => {
    try {
      const req = new TransferableRequest("https://example.com/test")
      const res = await getOrThrow("example", req)

      console.log(new Uint8Array(await res.arrayBuffer()))
    } catch (e: unknown) {
      console.error(e)
    }
  }, [getOrThrow])

  const onWebAuthnCreateClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()
      const window = open(`${TARGET.origin}/request`, "_blank")

      if (window == null)
        return

      const windowMessenger = new WindowMessenger(window, TARGET.origin)
      const windowRouter = new RpcRouter(channel.port1)

      await windowMessenger.pingOrThrow()

      window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

      await windowRouter.helloOrThrow(AbortSignal.timeout(1000))

      const data = new Uint8Array([1, 2, 3, 4, 5])

      const handle = await windowRouter.requestOrThrow<any>({
        method: "webauthn_storage_create",
        params: ["Example", data],
      }, [], AbortSignal.timeout(60_000)).then(([r]) => r.unwrap())

      const req = new TransferableRequest("https://example.com/handle")
      const res = new TransferableResponse(handle, { status: 200 })
      await setOrThrow("example", req, res)

      console.log("Created credential", data)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [setOrThrow])

  const onWebAuthnGetClick = useCallback(async () => {
    try {
      const req = new TransferableRequest("https://example.com/handle")
      const res = await getOrThrow("example", req)
      const handle = new Uint8Array(await res.arrayBuffer())

      const channel = new MessageChannel()
      const window = open(`${TARGET.origin}/request`, "_blank")

      if (window == null)
        return

      const windowMessenger = new WindowMessenger(window, TARGET.origin)
      const windowRouter = new RpcRouter(channel.port1)

      await windowMessenger.pingOrThrow()

      window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

      await windowRouter.helloOrThrow(AbortSignal.timeout(1000))

      const data = await windowRouter.requestOrThrow<any>({
        method: "webauthn_storage_get",
        params: [handle],
      }, [], AbortSignal.timeout(60_000)).then(([r]) => r.unwrap())

      console.log("Retrieved credential", data)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [getOrThrow])

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
      <button className="w-full"
        onClick={onWebAuthnCreateClick}>
        Create WebAuthn
      </button>
      <button className="w-full"
        onClick={onWebAuthnGetClick}>
        Get WebAuthn
      </button>
    </>}
  </main>
}