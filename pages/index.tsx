import { RpcRouter } from "@/libs/jsonrpc";
import { Client } from "@/libs/react/client";
import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit } from "@hazae41/jsonrpc";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  return <Client>
    <HashRouter />
  </Client>
}

export interface Exchange {
  readonly origin: string,
  readonly request: RpcRequestPreinit<unknown>,
  readonly response: Future<unknown>
}

export function HashRouter() {
  const [background, setBackground] = useState<RpcRouter>()
  const [exchange, setExchange] = useState<Exchange>()

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

        setExchange({ origin, request, response })

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

  const connect = useCallback(async () => {
    const channel = new MessageChannel()

    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const backgroundRouter = new RpcRouter(channel.port1)

    serviceWorker.postMessage({ method: "connect" }, [channel.port2])

    await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

    setBackground(backgroundRouter)
  }, [])

  useEffect(() => {
    connect()
  }, [connect])

  if (background == null)
    return null
  if (exchange == null)
    return null
  const { origin, request, response } = exchange

  if (request.method === "kv_ask") {
    const [name, capacity] = request.params as [string, number]

    return <KvAsk
      name={name}
      origin={origin}
      capacity={capacity}
      response={response}
      background={background} />
  }

  return null
}

export function KvAsk(props: {
  readonly name: string
  readonly origin: string,
  readonly capacity: number
  readonly background: RpcRouter
  readonly response: Future<unknown>,
}) {
  const { name, origin, capacity, background, response } = props

  const onAllow = useCallback(async () => {
    await background.requestOrThrow<void>({
      method: "kv_allow",
      params: [name, origin, capacity]
    }, AbortSignal.timeout(1000)).then(r => r.unwrap())

    response.resolve(undefined)
  }, [background, name, origin, capacity, response])

  const onReject = useCallback(async () => {
    response.reject(new Error(`User rejected`))
  }, [response])

  return <div>
    <div>
      {`Do you want to allow "${origin}" to access up to ${capacity / 1_000_000} MB in "${name}"`}
    </div>
    <button onClick={onAllow}>
      Allow
    </button>
    <button onClick={onReject}>
      Reject
    </button>
  </div>
}
