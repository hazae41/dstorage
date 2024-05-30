import { Disposer } from "@hazae41/disposer";
import { Future } from "@hazae41/future";
import { RpcCounter, RpcErr, RpcError, RpcId, RpcMethodNotFoundError, RpcOk, RpcRequest, RpcRequestInit, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc";

export type RpcMessageInit =
  | RpcRequestInit
  | RpcResponseInit

export class RpcRouter {

  readonly counter = new RpcCounter()
  readonly requests = new Map<RpcId, Future<RpcResponse<any>>>()
  readonly handlers = new Map<string, (request: RpcRequest<any>) => unknown>()

  readonly resolveOnHello = new Future<void>()

  #opened = false

  constructor(
    readonly port: MessagePort
  ) {
    port.addEventListener("message", async (event) => {
      if (typeof event.data !== "string")
        return
      const message = JSON.parse(event.data) as RpcMessageInit

      console.log(message)

      if (typeof message !== "object")
        return

      if ("method" in message) {
        const request = RpcRequest.from(message)
        this.#onRequest(request).catch(console.error)
      } else {
        const response = RpcResponse.from(message)
        this.requests.get(response.id)?.resolve(response)
      }
    })
  }

  async #onRequest(request: RpcRequest<unknown>) {
    if (!this.#opened)
      return

    if (request.method === "hello") {
      this.resolveOnHello.resolve()

      const response = new RpcOk(request.id, undefined)
      const data = JSON.stringify(response)

      this.port.postMessage(data)
      return
    }

    const handler = this.handlers.get(request.method)

    if (handler == null) {
      const error = new RpcMethodNotFoundError()
      const response = new RpcErr(request.id, error)
      const data = JSON.stringify(response)

      this.port.postMessage(data)
      return
    }

    try {
      const result = await handler(request)
      const response = new RpcOk(request.id, result)
      const data = JSON.stringify(response)

      this.port.postMessage(data)
      return
    } catch (e: unknown) {
      const error = RpcError.rewrap(e)
      const response = new RpcErr(request.id, error)
      const data = JSON.stringify(response)

      this.port.postMessage(data)
      return
    }
  }

  request<T>(init: RpcRequestPreinit) {
    const future = new Future<RpcResponse<T>>()
    const request = this.counter.prepare(init)

    this.requests.set(request.id, future)
    const clean = () => this.requests.delete(request.id)
    const disposer = new Disposer(future.promise, clean)

    this.port.postMessage(JSON.stringify(request))

    return disposer
  }

  async hello() {
    this.#opened = true

    const passive = this.resolveOnHello.promise
    const active = this.request<void>({ method: "hello" })

    try {
      await Promise.race([passive, active.get()])
    } finally {
      active.dispose()
    }
  }

}