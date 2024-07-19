import { RequestLike, ResponseLike, TransferableResponse } from "@/libs/http"
import { RpcRouter } from "@/libs/jsonrpc"
import { Kv } from "@/libs/storage"
import { Layout } from "@/mods/v0/comps/app"
import { RpcRequestPreinit } from "@hazae41/jsonrpc"
import { useCallback, useEffect, useState } from "react"

export default function Page() {
  return <Layout>
    <Subpage />
  </Layout>
}

export function Subpage() {
  const [handle, setHandle] = useState<any>()

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

      const origin = event.origin
      const router = new RpcRouter(port)

      router.handlers.set("kv_ask", async (rpcreq) => {
        const [scope] = rpcreq.params as [string]

        await Kv.ask(handle.caches, origin, scope)

        return []
      })

      router.handlers.set("kv_set", async (rpcreq) => {
        const [scope, reqlike, reslike] = rpcreq.params as [string, RequestLike, ResponseLike]

        const request = new Request(reqlike.url, reqlike)
        const response = new Response(reslike.body, reslike)

        await Kv.set(handle.caches, origin, scope, request, response)

        return []
      })

      router.handlers.set("kv_get", async (rpcreq) => {
        const [scope, reqlike] = rpcreq.params as [string, RequestLike]

        const request = new Request(reqlike.url, reqlike)
        const response = await Kv.get(handle.caches, origin, scope, request)

        if (response == null)
          return []

        const reslike = TransferableResponse.from(response)

        return [reslike.toJSON(), reslike.transferables]
      })

      await router.helloOrThrow(AbortSignal.timeout(1000))

      return
    }
  }, [handle])

  useEffect(() => {
    if (handle == null)
      return

    addEventListener("message", onMessage)
    return () => removeEventListener("message", onMessage)
  }, [handle, onMessage])

  const onClick = useCallback(async () => {
    // @ts-ignore
    const handle = await document.requestStorageAccess({ caches: true }) as any

    if (handle.caches == null)
      return

    console.log(handle)

    setHandle(handle)
  }, [])

  return <button onClick={onClick}>
    Grant
  </button>
}