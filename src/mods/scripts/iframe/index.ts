import { RpcRouter } from "@/libs/jsonrpc"

export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

window.addEventListener("message", async (event) => {
  console.debug(`${event.origin} -> ${location.origin}/iframe: ${event.data}`)

  /**
   * crossOrigin -> iframe
   */
  if (event.origin !== location.origin) {
    if (event.data !== "hello")
      return
    const [originPort] = event.ports

    if (originPort == null)
      return

    const iframeChannel = new MessageChannel()
    const iframePort = iframeChannel.port1
    const iframeRouter = new RpcRouter(iframePort)

    iframeRouter.handlers.set("open", async (request) => {
      const [url] = request.params as [string]
      open(url)
    })

    serviceWorker.postMessage(event.origin, [originPort, iframeChannel.port2])

    const iframeHello = iframeRouter.hello()
    iframePort.start()
    await iframeHello

    return
  }
})

console.log(location.origin, "iframe", "started")