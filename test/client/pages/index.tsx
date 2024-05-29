import { useCallback, useEffect, useState } from "react"

export default function Home() {
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null)
  const [port, setPort] = useState<MessagePort | null>(null)

  useEffect(() => {
    if (iframe == null)
      return

    /**
     * Wait for the iframe and its service-worker to load
     */
    setTimeout(async () => {
      const channel = new MessageChannel()

      /**
       * Wait for our service-worker to load
       */
      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      /**
       * Connect yall
       */
      iframe.contentWindow!.postMessage("hello", "*", [channel.port2])
      serviceWorker.postMessage("hello", [channel.port1])

      setPort(channel.port1)
    }, 1000)
  }, [iframe])

  const onClick = useCallback(() => {
    if (port == null)
      return

    open(`https://consensus-nonprofit-surgeons-camcorders.trycloudflare.com/#/kv_ask?name=test&origin=${location.origin}`, "_blank")
  }, [port])

  return <main className="">
    <iframe
      ref={setIframe}
      width={0}
      height={0}
      src="https://consensus-nonprofit-surgeons-camcorders.trycloudflare.com/iframe.html" />
    <button onClick={onClick}>
      ask
    </button>
  </main>
}
