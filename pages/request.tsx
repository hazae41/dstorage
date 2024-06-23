import "@hazae41/symbol-dispose-polyfill";

import { RpcRouter } from "@/libs/jsonrpc";
import { useBackgroundContext } from "@/mods/comps/background";
import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit } from "@hazae41/jsonrpc";
import { WebAuthnStorage } from "@hazae41/webauthnstorage";
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
    const [message] = event.data as [RpcRequestPreinit]

    if (message.method === "ping") {
      if (event.source == null)
        return
      event.source.postMessage([{ method: "pong" }], { targetOrigin: event.origin })
      return
    }

    if (message.method === "connect") {
      const [port] = event.ports

      if (port == null)
        return

      const router = new RpcRouter(port)

      const onRequest = async (request: RpcRequest<unknown>) => {
        const { method, params } = request

        const origin = event.origin
        const future = new Future<unknown>()

        setMessage({ method, origin, params, future })

        return [await future.promise] as const
      }

      router.handlers.set("kv_ask", onRequest)
      router.handlers.set("webauthn_storage_create", onRequest)
      router.handlers.set("webauthn_storage_get", onRequest)

      await router.helloOrThrow(AbortSignal.timeout(1000))

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
  if (message.method === "webauthn_storage_create")
    return <WebAuthnStorageCreate message={message} />
  if (message.method === "webauthn_storage_get")
    return <WebAuthnStorageGet message={message} />

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
    await background.router.requestOrThrow<void>({
      method: "kv_ask",
      params: [scope, origin, capacity]
    }, [], AbortSignal.timeout(1000)).then(([r]) => r.unwrap())

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

export function WebAuthnStorageCreate(props: {
  readonly message: Message
}) {
  const { message } = props
  const { origin, params, future } = message
  const [name, data] = params as [string, Uint8Array]

  const onAllow = useCallback(async () => {
    const handle = await WebAuthnStorage.createOrThrow(name, data)

    future.resolve(handle)

    close()
  }, [future, name, data])

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

export function WebAuthnStorageGet(props: {
  readonly message: Message
}) {
  const { message } = props
  const { origin, params, future } = message
  const [handle] = params as [Uint8Array]

  const onAllow = useCallback(async () => {
    const data = await WebAuthnStorage.getOrThrow(handle)

    future.resolve(data)

    close()
  }, [future, handle])

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