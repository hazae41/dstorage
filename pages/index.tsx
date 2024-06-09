import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { WindowMessenger } from "@/libs/messenger";
import { Client } from "@/libs/react/client";
import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit } from "@hazae41/jsonrpc";
import { Nullable } from "@hazae41/option";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  return <Client>
    <Connector />
  </Client>
}

export function Connector() {
  const [iframe, setIframe] = useState<Nullable<HTMLIFrameElement>>(null)

  const [origin, setOrigin] = useState<string>()
  const [request, setRequest] = useState<RpcRequestPreinit<unknown>>()
  const [response, setResponse] = useState<Future<unknown>>()

  const [background, setBackground] = useState<RpcRouter>()

  const onMessage = useCallback(async (event: MessageEvent) => {
    if (event.origin === location.origin)
      return
    const message = event.data as RpcRequestPreinit

    if (message.method === "ping") {
      if (event.source == null)
        return
      event.source.postMessage({ method: "pong" }, { targetOrigin: event.origin })
      return
    }

    if (message.method === "connect") {
      const [parentPort] = event.ports

      if (parentPort == null)
        return
      const parentRouter = new RpcRouter(parentPort)

      const onRequest = async (request: RpcRequest<unknown>) => {
        const origin = event.origin
        const response = new Future<unknown>()

        setOrigin(origin)
        setRequest(request)
        setResponse(response)

        return await response.promise
      }

      parentRouter.handlers.set("kv_ask", onRequest)
      parentRouter.handlers.set("webauthn_kv_set", onRequest)
      parentRouter.handlers.set("webauthn_kv_get", onRequest)

      await parentRouter.helloOrThrow(AbortSignal.timeout(1000))

      return
    }
  }, [])

  useEffect(() => {
    addEventListener("message", onMessage)
    return () => removeEventListener("message", onMessage)
  }, [onMessage])

  const connectOrThrow = useCallback(async () => {
    if (iframe == null)
      return
    if (iframe.contentWindow == null)
      return

    const channel = new MessageChannel()

    const iframeMessenger = new WindowMessenger(iframe.contentWindow, location.origin)

    await iframeMessenger.pingOrThrow()

    const iframeRouter = new RpcRouter(channel.port1)

    iframe.contentWindow.postMessage({ method: "connect2" }, location.origin, [channel.port2])

    await iframeRouter.helloOrThrow(AbortSignal.timeout(1000))

    setBackground(iframeRouter)
  }, [iframe])

  useEffect(() => {
    connectOrThrow().catch(console.error)
  }, [connectOrThrow])

  return <>
    <iframe
      width={0}
      height={0}
      ref={setIframe}
      src="/iframe.html" />
    {origin && request && response && background &&
      <Router
        origin={origin}
        request={request}
        response={response}
        background={background} />}
  </>
}

export function Router(props: {
  readonly origin: string,
  readonly request: RpcRequestPreinit<unknown>
  readonly response: Future<unknown>
  readonly background: RpcRouter
}) {
  const { origin, background, request, response } = props

  if (request.method === "kv_ask") {
    const [scope, capacity] = request.params as [string, number]

    return <KvAsk
      scope={scope}
      origin={origin}
      capacity={capacity}
      response={response}
      background={background} />
  }

  return null
}

export function KvAsk(props: {
  readonly scope: string
  readonly origin: string,
  readonly capacity: number
  readonly background: RpcRouter
  readonly response: Future<unknown>,
}) {
  const { scope, origin, capacity, background, response } = props

  const onAllow = useCallback(async () => {
    await background.requestOrThrow<void>({
      method: "kv_ask",
      params: [scope, origin, capacity]
    }, [], AbortSignal.timeout(1000)).then(r => r.unwrap())

    response.resolve(undefined)

    close()
  }, [background, scope, origin, capacity, response])

  const onReject = useCallback(async () => {
    response.reject(new Error(`User rejected`))
  }, [response])

  return <div>
    <div>
      {`Do you want to allow "${origin}" to access up to ${capacity / 1_000_000} MB in "${scope}"`}
    </div>
    <button onClick={onAllow}>
      Allow
    </button>
    <button onClick={onReject}>
      Reject
    </button>
  </div>
}
