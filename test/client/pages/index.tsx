import { useEffect, useState } from "react"

export default function Home() {
  const [done, setDone] = useState(false)
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (iframe == null)
      return

    const channel = new MessageChannel()

    /**
     * Wait for the iframe and its service-worker to load
     */
    setTimeout(async () => {
      /**
       * Wait for our service-worker to load
       */
      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      /**
       * Connect yall
       */
      iframe.contentWindow!.postMessage("service_worker", "*", [channel.port2])
      serviceWorker.postMessage("service_worker", [channel.port1])

      /**
       * We can close the iframe
       */
      setTimeout(() => setDone(true), 1000)
    }, 1000)
  }, [iframe])

  return <main className="">
    {!done &&
      <iframe
        ref={setIframe}
        width={0}
        height={0}
        src="https://wool-ws-nice-shown.trycloudflare.com/iframe.html" />}
  </main>
}
