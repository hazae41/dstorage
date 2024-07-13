import "@hazae41/symbol-dispose-polyfill";

import { ResponseLike, TransferableRequest, TransferableResponse } from "@/libs/http";
import { RpcRouter } from "@/libs/jsonrpc";
import { WindowMessenger } from "@/libs/messenger";
import { useBackgroundContext } from "@/mods/comps/background";
import { Nullable } from "@hazae41/option";
import { useCallback, useEffect, useState } from "react";

const TARGET = new URL("https://cheaper-cuba-delivery-count.trycloudflare.com/v1")

export default function Home() {
  const background = useBackgroundContext()

  const [iframe, setIframe] = useState<Nullable<HTMLIFrameElement>>()

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

  const connectOrThrow = useCallback(async () => {
    if (iframe == null)
      return
    if (iframe.contentWindow == null)
      return

    const channel = new MessageChannel()

    await WindowMessenger.pingOrThrow(iframe.contentWindow, TARGET.origin)

    iframe.contentWindow.postMessage([{ method: "connect" }], TARGET.origin, [channel.port1])
    background.worker.postMessage([{ method: "connect3", params: [TARGET.origin] }], [channel.port2])
  }, [background, iframe])

  const onConnectClick = useCallback(async () => {
    connectOrThrow()
  }, [connectOrThrow])

  const onAskClick = useCallback(async () => {
    try {
      const window = open(`${TARGET}/request`, "_blank")

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
      const window = open(`${TARGET}/request`, "_blank")

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
      const window = open(`${TARGET}/request`, "_blank")

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
    <iframe className="w-full h-96"
      ref={setIframe}
      src={`${TARGET}/iframe`} />
    {background.update != null &&
      <button className="w-full"
        onClick={background.update}>
        Update
      </button>}
    <button className="w-full"
      onClick={onAskClick}>
      Ask permission
    </button>
    {!piped &&
      <button className="w-full"
        onClick={onConnectClick}>
        Connect
      </button>}
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