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

  const [originRouter, setOriginRouter] = useState<RpcRouter | null>(null)
  const [pageRouter, setPageRouter] = useState<RpcRouter | null>(null)

  const current = useRef<{
    readonly request: RpcRequest<unknown>,
    readonly response: Future<RpcResponse>
  }>()

  const onMessage = useCallback(async (event: MessageEvent) => {
    if (event.origin === location.origin)
      return
    const message = JSON.parse(event.data) as RpcRequestPreinit

    if (message.method === "ping") {
      if (event.source == null)
        return
      event.source.postMessage(JSON.stringify({ method: "pong" }), { targetOrigin: event.origin })
      return
    }

    if (message.method === "connect") {
      const [originPort] = event.ports

      if (originPort == null)
        return
      const originRouter = new RpcRouter(originPort)

      originRouter.handlers.set("kv_ask", async (request) => {
        const [name] = request.params

        const response = new Future<RpcResponse>()
        current.current = { request, response }

        location.assign(`/#/kv_ask?name=${name}`)

        return await response.promise.then(r => r.unwrap())
      })

      await originRouter.hello()

      setOriginRouter(originRouter)
      return
    }
  }, [])

  useEffect(() => {
    addEventListener("message", onMessage)
    return () => removeEventListener("message", onMessage)
  }, [onMessage])

  const connect = useCallback(async () => {
    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const pageChannel = new MessageChannel()
    const pagePort = pageChannel.port1
    const pageRouter = new RpcRouter(pagePort)

    serviceWorker.postMessage(JSON.stringify({ method: "connect" }), [pageChannel.port2])

    await pageRouter.hello()

    setPageRouter(pageRouter)
  }, [])

  useEffect(() => {
    connect()
  }, [connect])

  if (originRouter == null)
    return null
  if (pageRouter == null)
    return null

  if (url.pathname === "/kv_ask") {
    const name = url.searchParams.get("name")!

    return <KvAsk
      name={name}
      originRouter={originRouter}
      pageRouter={pageRouter} />
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
    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const pageChannel = new MessageChannel()
    const pagePort = pageChannel.port1
    const pageRouter = new RpcRouter(pagePort)

    serviceWorker.postMessage(location.origin, [pageChannel.port2])

    await pageRouter.hello()

    // await pageRouter.request({
    //   method: "global_respond",
    //   params: [new RpcOk(id, true)]
    // }).await().then(r => r.unwrap())
  }, [])

  const onReject = useCallback(async () => {
    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const pageChannel = new MessageChannel()
    const pagePort = pageChannel.port1
    const pageRouter = new RpcRouter(pagePort)

    serviceWorker.postMessage(JSON.stringify({ method: "connect" }), [pageChannel.port2])

    await pageRouter.hello()

    // await pageRouter.request({
    //   method: "global_respond",
    //   params: [new RpcOk(id, false)]
    // }).await().then(r => r.unwrap())
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
