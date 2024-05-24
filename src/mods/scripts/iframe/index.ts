import { Future } from "@hazae41/future"
import { RpcCounter, RpcErr, RpcError, RpcId, RpcOk, RpcRequest, RpcRequestInit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc"

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
    const [originPort] = event.ports

    if (originPort == null)
      return

    const iframeChannel = new MessageChannel()
    const iframePort = iframeChannel.port1

    const iframeCounter = new RpcCounter()
    const iframeRequests = new Map<RpcId, Future<RpcResponse>>()

    const onIframeRequest = async (request: RpcRequest<unknown>) => {
      if (request.method === "open") {
        const [url] = request.params as [string]

        open(url, "_blank", "norefferer")
        return
      }
    }

    iframePort.addEventListener("message", async (event) => {
      if (typeof event.data !== "string")
        return
      const requestOrResponse = JSON.parse(event.data) as RpcRequestInit | RpcResponseInit

      if (typeof requestOrResponse !== "object")
        return

      if ("method" in requestOrResponse) {
        const request = RpcRequest.from(requestOrResponse)

        try {
          const result = await onIframeRequest(request)
          const response = new RpcOk(request.id, result)
          const data = JSON.stringify(response)

          iframePort.postMessage(data)
          return
        } catch (e: unknown) {
          const error = RpcError.rewrap(e)
          const response = new RpcErr(request.id, error)
          const data = JSON.stringify(response)

          iframePort.postMessage(data)
          return
        }
      } else {
        const response = RpcResponse.from(requestOrResponse)

        iframeRequests.get(response.id)?.resolve(response)
        return
      }
    })

    serviceWorker.postMessage(event.origin, [originPort, iframeChannel.port2])

    iframePort.start()
    return
  }
})

console.log(location.origin, "iframe", "started")