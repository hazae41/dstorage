import { useEffect, useState } from "react"

export default function Home() {
  const [done, setDone] = useState(false)
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (iframe == null)
      return

    const channel = new MessageChannel()

    setTimeout(async () => {
      await navigator.serviceWorker.register("/service_worker.js")
      const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

      iframe.contentWindow!.postMessage("service_worker", "*", [channel.port2])
      serviceWorker.postMessage("service_worker", [channel.port1])

      setTimeout(() => setDone(true), 1000)
    }, 1000)
  }, [iframe])

  return <main className="">
    {!done &&
      <iframe
        ref={setIframe}
        src="https://craps-sanyo-en-skiing.trycloudflare.com/iframe.html" />}
  </main>
}
