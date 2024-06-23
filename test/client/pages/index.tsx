import "@hazae41/symbol-dispose-polyfill";

import { ResponseLike, TransferableRequest, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { WindowMessenger } from "@/libs/messenger";
import { useBackgroundContext } from "@/mods/comps/background";
import { useCallback, useEffect, useState } from "react";

const TARGET = new URL("https://dstorage.hazae41.me")

export interface Connector {
  readonly window: Window
  readonly router: RpcRouter
  readonly updatable: boolean
}

export default function Home() {
  const background = useBackgroundContext()

  const [piped, setPiped] = useState(false)

  const pingOrThrow = useCallback(async () => {
    while (!background.router.closed) {
      try {
        await background.router.requestOrThrow<boolean>({
          method: "proxy",
          params: [{ method: "hello" }]
        }).then(([r]) => r.unwrap())

        console.log("Connected")
        setPiped(true)
      } catch (e: unknown) {
        console.log("Not connected", e)
        setPiped(false)
      } finally {
        await new Promise(ok => setTimeout(ok, 1000))
      }
    }
  }, [background])

  useEffect(() => {
    pingOrThrow().catch(console.error)
  }, [pingOrThrow])

  const [connector, setConnector] = useState<Connector>()

  const pipeOrThrow = useCallback(async (connector2 = connector) => {
    const connector = connector2

    if (connector == null)
      return

    const channel = new MessageChannel()

    await WindowMessenger.pingOrThrow(connector.window, TARGET.origin)

    connector.window.postMessage([{ method: "connect2" }], TARGET.origin, [channel.port1])
    background.worker.postMessage([{ method: "connect3", params: [TARGET.origin] }], [channel.port2])
  }, [background, connector])

  const connectOrThrow = useCallback(async () => {
    const window = open(`${TARGET.origin}/connect`, "_blank", "width=100,height=100")

    if (window == null)
      return

    const channel = new MessageChannel()
    const router = new RpcRouter(channel.port1)

    await WindowMessenger.pingOrThrow(window, TARGET.origin)

    window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

    await router.helloOrThrow(AbortSignal.timeout(1000))

    const updatable = await router.requestOrThrow<boolean>({
      method: "sw_update_check"
    }).then(([r]) => r.unwrap())

    const connector = { router, window, updatable }

    setConnector(connector)

    router.resolveOnClose.promise.then(() => setConnector(current => {
      if (current !== connector)
        return current
      return undefined
    }))

    if (updatable)
      return
    await pipeOrThrow(connector)
  }, [pipeOrThrow])

  const updateOrThrow = useCallback(async () => {
    if (connector == null)
      return

    await connector.router.requestOrThrow<void>({
      method: "sw_update_allow"
    }).then(([r]) => r.unwrap())

    await connectOrThrow()
  }, [connector])

  const onConnectClick = useCallback(async () => {
    connectOrThrow()
  }, [connectOrThrow])

  const onUpdateClick = useCallback(async () => {
    updateOrThrow()
  }, [updateOrThrow])

  const onPipeClick = useCallback(async () => {
    pipeOrThrow()
  }, [pipeOrThrow])

  const onAskClick = useCallback(async () => {
    try {
      const window = open(`${TARGET.origin}/request`, "_blank")

      if (window == null)
        return

      const channel = new MessageChannel()
      const router = new RpcRouter(channel.port1)

      await WindowMessenger.pingOrThrow(window, TARGET.origin)

      window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

      await router.helloOrThrow(AbortSignal.timeout(1000))

      await router.requestOrThrow<void>({
        method: "kv_ask",
        params: ["example", 5_000_000],
      }, [], AbortSignal.timeout(60_000)).then(([r]) => r.unwrap())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  const setOrThrow = useCallback(async (scope: string, req: TransferableRequest, res: TransferableResponse) => {
    await background.router.requestOrThrow<void>({
      method: "proxy",
      params: [{
        method: "kv_set",
        params: [scope, req.toJSON(), res.toJSON()],
      }]
    }, [...req.transferables, ...res.transferables]).then(([r]) => r.unwrap())
  }, [background])

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
    const res = await background.router.requestOrThrow<ResponseLike>({
      method: "proxy",
      params: [{
        method: "kv_get",
        params: [scope, req.toJSON()],
      }]
    }, req.transferables).then(([r]) => r.unwrap())

    return new Response(res.body, res)
  }, [background])

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
      const window = open(`${TARGET.origin}/request`, "_blank")

      if (window == null)
        return

      const channel = new MessageChannel()
      const router = new RpcRouter(channel.port1)

      await WindowMessenger.pingOrThrow(window, TARGET.origin)

      window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

      await router.helloOrThrow(AbortSignal.timeout(1000))

      const data = new Uint8Array([1, 2, 3, 4, 5])

      const handle = await router.requestOrThrow<any>({
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
      const window = open(`${TARGET.origin}/request`, "_blank")

      if (window == null)
        return

      const channel = new MessageChannel()
      const router = new RpcRouter(channel.port1)

      await WindowMessenger.pingOrThrow(window, TARGET.origin)

      window.postMessage([{ method: "connect" }], TARGET.origin, [channel.port2])

      await router.helloOrThrow(AbortSignal.timeout(1000))

      const req = new TransferableRequest("https://example.com/handle")
      const res = await getOrThrow("example", req)
      const handle = new Uint8Array(await res.arrayBuffer())

      const data = await router.requestOrThrow<any>({
        method: "webauthn_storage_get",
        params: [handle],
      }, [], AbortSignal.timeout(60_000)).then(([r]) => r.unwrap())

      console.log("Retrieved credential", data)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [getOrThrow])

  return <main className="">
    {background.update != null &&
      <button className="w-full"
        onClick={background.update}>
        Update
      </button>}
    <button className="w-full"
      onClick={onAskClick}>
      Ask permission
    </button>
    {!piped && connector == null &&
      <button className="w-full"
        onClick={onConnectClick}>
        Connect
      </button>}
    {!piped && connector != null && connector?.updatable && <>
      An update is available:
      <button className="w-full"
        onClick={onUpdateClick}>
        Update
      </button>
      <button className="w-full"
        onClick={onPipeClick}>
        Ignore
      </button>
    </>}
    {piped && <>
      Connected:
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