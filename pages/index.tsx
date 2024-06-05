import { RpcRouter } from "@/libs/jsonrpc";
import { Client } from "@/libs/react/client";
import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit, RpcResponse } from "@hazae41/jsonrpc";
import { useCallback, useEffect, useRef, useState } from "react";

export default function Home() {
  return <Client>
    <HashRouter />
  </Client>
}

export function HashRouter() {
  const url = new URL(location.hash.slice(1), location.origin)

  const [parentRouter, setParentRouter] = useState<RpcRouter | null>(null)
  const [backgroundRouter, setBackgroundRouter] = useState<RpcRouter | null>(null)

  const current = useRef<{
    readonly request: RpcRequest<unknown>,
    readonly response: Future<RpcResponse>
  }>()

  const onMessage = useCallback(async (event: MessageEvent) => {
    if (event.origin === location.origin)
      return
    if (typeof event.data !== "string")
      return
    const message = JSON.parse(event.data) as RpcRequestPreinit

    if (message.method === "ping") {
      if (event.source == null)
        return
      event.source.postMessage(JSON.stringify({ method: "pong" }), { targetOrigin: event.origin })
      return
    }

    if (message.method === "connect") {
      const [parentPort] = event.ports

      if (parentPort == null)
        return
      const parentRouter = new RpcRouter(parentPort)

      parentRouter.handlers.set("kv_ask", async (request) => {
        const [name] = request.params

        const response = new Future<RpcResponse>()
        current.current = { request, response }

        location.assign(`/#/kv_ask?name=${name}`)

        return await response.promise.then(r => r.unwrap())
      })

      await parentRouter.helloOrThrow(AbortSignal.timeout(1000))

      setParentRouter(parentRouter)
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

    serviceWorker.postMessage(JSON.stringify({ method: "connect" }), [channel.port2])

    await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

    setBackgroundRouter(backgroundRouter)
  }, [])

  useEffect(() => {
    connect()
  }, [connect])

  if (parentRouter == null)
    return null
  if (backgroundRouter == null)
    return null

  if (url.pathname === "/kv_ask") {
    const name = url.searchParams.get("name")!

    return <KvAsk
      name={name}
      originRouter={parentRouter}
      pageRouter={backgroundRouter} />
  }

  return null
}

export function KvAsk(props: {
  readonly name: string
  readonly originRouter: RpcRouter
  readonly pageRouter: RpcRouter
}) {
  const { name, originRouter, pageRouter } = props

  const onAllow = useCallback(async () => {

  }, [])

  const onReject = useCallback(async () => {

  }, [])

  return <div>
    <div>
      {`Do you want to allow "${origin}" to access "${name}"`}
    </div>
    <button onClick={onAllow}>
      Allow
    </button>
    <button onClick={onReject}>
      Reject
    </button>
  </div>
}
