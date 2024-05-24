import { Client } from "@/libs/react/client";
import { RpcCounter, RpcOk } from "@hazae41/jsonrpc";
import { useCallback } from "react";

export default function Home() {
  return <Client>
    <HashRouter />
  </Client>
}

export function HashRouter() {
  const url = new URL(location.hash.slice(1), location.origin)

  if (url.pathname === "/kv_ask") {
    const id = url.searchParams.get("id")!
    const origin = url.searchParams.get("origin")!
    const name = url.searchParams.get("name")!

    return <KvAsk
      id={id}
      name={name}
      origin={origin} />
  }

  return null
}

export function KvAsk(props: {
  readonly id: string
  readonly name: string
  readonly origin: string
}) {
  const { id, name, origin } = props

  const onAllow = useCallback(async () => {
    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const pageCounter = new RpcCounter()
    const pageChannel = new MessageChannel()
    const pagePort = pageChannel.port1

    serviceWorker.postMessage(location.origin, [pageChannel.port2])

    const globalResponse = new RpcOk(id, true)

    pagePort.postMessage(JSON.stringify(pageCounter.prepare({ method: "global_respond", params: [globalResponse] })))
    pagePort.start()
  }, [id])

  const onReject = useCallback(async () => {
    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    const pageCounter = new RpcCounter()
    const pageChannel = new MessageChannel()
    const pagePort = pageChannel.port1

    serviceWorker.postMessage(location.origin, [pageChannel.port2])

    const globalResponse = new RpcOk(id, false)

    pagePort.postMessage(JSON.stringify(pageCounter.prepare({ method: "global_respond", params: [globalResponse] })))
    pagePort.start()
  }, [id])

  return <div>
    <div>
      {`"${origin}" wants to access "${name}"`}
    </div>
    <button onClick={onAllow}>
      Allow
    </button>
    <button onClick={onReject}>
      Reject
    </button>
  </div>
}
