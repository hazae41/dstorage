import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { useBackgroundContext } from "@/mods/comps/background";
import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit } from "@hazae41/jsonrpc";
import { Optional } from "@hazae41/option";
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
    // @ts-ignore
    await document.requestStorageAccess({ caches: true })

    await background.requestOrThrow<void>({
      method: "kv_ask",
      params: [scope, origin, capacity]
    }, [], AbortSignal.timeout(1000)).then(r => r.unwrap())

    future.resolve(undefined)

    close()
  }, [background, scope, origin, capacity, future])

  const onReject = useCallback(async () => {
    future.reject(new Error(`User rejected`))

    close()
  }, [future])

  return <div className="p-4 w-[1000px]">
    <div className="flex flex-wrap items-center gap-1">
      <span>
        {`Do you want to allow`}
      </span>
      <span className="p-1 border rounded-xl">
        {origin}
      </span>
      <span className="">
        {`to access up to`}
      </span>
      <span className="p-1 border rounded-xl">
        {capacity / 1_000_000} MB
      </span>
      <span className="">
        {`in`}
      </span>
      <span className="p-1 border rounded-xl">
        {scope}
      </span>
      <span className="">
        {`?`}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <button className="p-1 border rounded-xl"
        onClick={onAllow}>
        Allow
      </button>
      <button className="p-1 border rounded-xl"
        onClick={onReject}>
        Reject
      </button>
    </div>
  </div>
}

export function WebAuthnCreate(props: {
  readonly message: Message
}) {
  const { message } = props
  const { origin, params, future } = message
  const [options] = params as [Optional<CredentialCreationOptions>]

  const onAllow = useCallback(async () => {
    const credential = await navigator.credentials.create(options)

    future.resolve(credential)
  }, [future, options])

  const onReject = useCallback(async () => {
    future.reject(new Error(`User rejected`))
  }, [future])

  return <div className="p-4 w-[1000px]">
    <div className="flex flex-wrap items-center gap-1">
      <span>
        {`Do you want to allow`}
      </span>
      <span className="p-1 border rounded-xl">
        {origin}
      </span>
      <span className="">
        {`to create a new credential?`}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <button className="p-1 border rounded-xl"
        onClick={onAllow}>
        Allow
      </button>
      <button className="p-1 border rounded-xl"
        onClick={onReject}>
        Reject
      </button>
    </div>
  </div>
}

export function WebAuthnGet(props: {
  readonly message: Message
}) {
  const { message } = props
  const { origin, params, future } = message
  const [options] = params as [Optional<CredentialRequestOptions>]

  const onAllow = useCallback(async () => {
    const credential = await navigator.credentials.get(options)

    future.resolve(credential)
  }, [future, options])

  const onReject = useCallback(async () => {
    future.reject(new Error(`User rejected`))
  }, [future])

  return <div className="p-4 w-[1000px]">
    <div className="flex flex-wrap items-center gap-1">
      <span>
        {`Do you want to allow`}
      </span>
      <span className="p-1 border rounded-xl">
        {origin}
      </span>
      <span className="">
        {`to get a credential?`}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <button className="p-1 border rounded-xl"
        onClick={onAllow}>
        Allow
      </button>
      <button className="p-1 border rounded-xl"
        onClick={onReject}>
        Reject
      </button>
    </div>
  </div>
}