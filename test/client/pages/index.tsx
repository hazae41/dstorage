import { RpcRouter } from "@/libs/jsonrpc"
import { WindowMessenger } from "@/libs/messenger"
import { useCallback, useEffect, useState } from "react"

const TARGET = "https://auction-banners-acoustic-princeton.trycloudflare.com"

export default function Home() {
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null)

  const connect = useCallback(async () => {
    if (iframe == null)
      return
    if (iframe.contentWindow == null)
      return
    const channel = new MessageChannel()

    const iframeMessenger = new WindowMessenger(iframe.contentWindow, TARGET)

    /**
     * Wait for our service-worker to load
     */
    await navigator.serviceWorker.register("/service_worker.js")
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

    /**
     * Wait for the iframe to load
     */
    await iframeMessenger.pingOrThrow()

    /**
     * Connect yall
     */
    iframe.contentWindow.postMessage(JSON.stringify({ method: "connect2" }), TARGET, [channel.port1])
    serviceWorker.postMessage(JSON.stringify({ method: "connect" }), [channel.port2])
  }, [iframe])

  useEffect(() => {
    if (iframe == null)
      return
    if (iframe.contentWindow == null)
      return
    connect()
  }, [iframe, connect])

  const onClick = useCallback(async () => {
    const channel = new MessageChannel()
    const window = open(`${TARGET}`, "_blank")

    if (window == null)
      return
    const windowMessenger = new WindowMessenger(window, TARGET)
    const windowRouter = new RpcRouter(channel.port1)

    await windowMessenger.pingOrThrow()

    window.postMessage(JSON.stringify({ method: "connect" }), TARGET, [channel.port2])

    await windowRouter.helloOrThrow()
  }, [])

  return <main className="">
    <iframe
      ref={setIframe}
      width={0}
      height={0}
      src={`${TARGET}/iframe.html`} />
    <button onClick={onClick}>
      ask
    </button>
  </main>
}
