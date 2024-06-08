import { RpcRouter } from "@/libs/jsonrpc"
import { WindowMessenger } from "@/libs/messenger"
import { useCallback, useState } from "react"

const TARGET = "https://tabs-warehouse-college-reed.trycloudflare.com"

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
    iframe.contentWindow.postMessage({ method: "connect2" }, TARGET, [channel.port1])
    serviceWorker.postMessage({ method: "connect3", params: [TARGET] }, [channel.port2])
  }, [iframe])

  const onAskClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()
      const window = open(`${TARGET}`, "_blank")

      if (window == null)
        return

      const windowMessenger = new WindowMessenger(window, TARGET)
      const windowRouter = new RpcRouter(channel.port1)

      await windowMessenger.pingOrThrow()

      window.postMessage({ method: "connect" }, TARGET, [channel.port2])

      await windowRouter.helloOrThrow(AbortSignal.timeout(1000))

      await windowRouter.requestOrThrow<void>({
        method: "kv_ask",
        params: ["https://example.com", 5_000_000],
      }, [], AbortSignal.timeout(60_000)).then(r => r.unwrap())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  const [enabled, setEnabled] = useState(false)

  const onEnableClick = useCallback(async () => {
    setEnabled(true)
  }, [])

  const onConnectClick = useCallback(async () => {
    connect()
  }, [connect])

  const onSetClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()

      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      const backgroundRouter = new RpcRouter(channel.port1)

      serviceWorker.postMessage({ method: "connect" }, [channel.port2])

      await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

      await backgroundRouter.requestOrThrow<void>({
        method: "kv_set",
        params: ["https://example.com", "buffer", new Uint8Array([1, 2, 3, 4, 5])],
      }).then(r => r.unwrap())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  const onGetClick = useCallback(async () => {
    try {
      const channel = new MessageChannel()

      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      const backgroundRouter = new RpcRouter(channel.port1)

      serviceWorker.postMessage({ method: "connect" }, [channel.port2])

      await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

      const buffer = await backgroundRouter.requestOrThrow<ArrayBuffer>({
        method: "kv_get",
        params: ["https://example.com", "buffer"],
      }).then(r => r.unwrap())

      console.log(buffer)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [])

  return <main className="">
    {enabled &&
      <iframe
        ref={setIframe}
        width={0}
        height={0}
        src={`${TARGET}/iframe.html`} />}
    <button className="w-full"
      onClick={onAskClick}>
      Ask permission
    </button>
    <button className="w-full"
      onClick={onEnableClick}>
      Enable
    </button>
    <button className="w-full"
      onClick={onConnectClick}>
      Connect
    </button>
    <button className="w-full"
      onClick={onSetClick}>
      Set value
    </button>
    <button className="w-full"
      onClick={onGetClick}>
      Get value
    </button>
  </main>
}
