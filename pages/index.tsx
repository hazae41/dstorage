import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { useBackgroundContext } from "@/mods/comps/background";
import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit } from "@hazae41/jsonrpc";
import { useCallback, useEffect, useState } from "react";

export interface Message {
  readonly method: string
  readonly origin: string
  readonly params: unknown
  readonly future: Future<unknown>
}

export default function Home() {
  const [message, setMessage] = useState<Message>()

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
        const { method, params } = request

        const origin = event.origin
        const future = new Future<unknown>()

        setMessage({ method, origin, params, future })

        return await future.promise
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

  if (message == null)
    return null

  return <Router message={message} />
}


export function Router(props: {
  readonly message: Message
}) {
  const { message } = props

  if (message.method === "kv_ask")
    return <KvAsk message={message} />

  return null
}

export function KvAsk(props: {
  readonly message: Message
}) {
  const background = useBackgroundContext()
  const { message } = props
  const { origin, params, future } = message
  const [scope, capacity] = params as [string, number]

  const onAllow = useCallback(async () => {
    await document.requestStorageAccess()

    await background.requestOrThrow<void>({
      method: "kv_ask",
      params: [scope, origin, capacity]
    }, [], AbortSignal.timeout(1000)).then(r => r.unwrap())

    future.resolve(undefined)

    close()
  }, [background, scope, origin, capacity, future])

  const onReject = useCallback(async () => {
    future.reject(new Error(`User rejected`))
  }, [future])

  return <div>
    <div>
      {`Do you want to allow`}
    </div>
    <div className="">
      {origin}
    </div>
    <div className="">
      {`to access up to`}
    </div>
    <div className="">
      {capacity / 1_000_000} MB
    </div>
    <div className="">
      {`in`}
    </div>
    <div className="">
      {scope}
    </div>
    <button onClick={onAllow}>
      Allow
    </button>
    <button onClick={onReject}>
      Reject
    </button>
  </div>
}
