import { Disposer } from "@hazae41/disposer";
import { Future } from "@hazae41/future";
import { RpcCounter, RpcErr, RpcError, RpcId, RpcMethodNotFoundError, RpcOk, RpcRequest, RpcRequestInit, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc";
import { Signals } from "@hazae41/signals";

export type RpcMessageInit =
  | RpcRequestInit
  | RpcResponseInit

export class RpcRouter {

  readonly counter = new RpcCounter()
  readonly requests = new Map<RpcId, Future<RpcResponse<any>>>()
  readonly handlers = new Map<string, (request: RpcRequest<any>) => unknown>()

  readonly resolveOnHello = new Future<void>()
  readonly resolveOnClose = new Future<unknown>()

  constructor(
    readonly port: MessagePort
  ) {
    const onMessage = this.#onMessage.bind(this)

    port.addEventListener("message", onMessage, { passive: true })

    this.resolveOnClose.promise.then(() => {
      port.removeEventListener("message", onMessage)
      port.close()
    })
  }

  async #onMessage(event: MessageEvent) {
    const message = event.data as RpcMessageInit

    if (typeof message !== "object")
      return

    if ("method" in message) {
      const request = RpcRequest.from(message)
      this.#onRequest(request).catch(console.error)
    } else {
      const response = RpcResponse.from(message)
      this.requests.get(response.id)?.resolve(response)
    }
  }

  async #onRequest(request: RpcRequest<unknown>) {
    if (request.method === "hello") {
      this.resolveOnHello.resolve()

      const response = new RpcOk(request.id, undefined)

      this.port.postMessage(response)
      return
    }

    const handler = this.handlers.get(request.method)

    if (handler == null) {
      const error = new RpcMethodNotFoundError()
      const response = new RpcErr(request.id, error)

      this.port.postMessage(response)
      return
    }

    try {
      const result = await handler(request)
      const response = new RpcOk(request.id, result)

      if (result instanceof ArrayBuffer) {
        this.port.postMessage(response, [result])
        return
      } else {
        this.port.postMessage(response)
        return
      }
    } catch (e: unknown) {
      const error = RpcError.rewrap(e)
      const response = new RpcErr(request.id, error)

      this.port.postMessage(response)
      return
    }
  }

  #request<T>(init: RpcRequestPreinit, transferables: Transferable[] = []) {
    const resolveOnResponse = new Future<RpcResponse<T>>()

    const request = this.counter.prepare(init)

    this.requests.set(request.id, resolveOnResponse)
    const clean = () => this.requests.delete(request.id)
    const disposer = new Disposer(resolveOnResponse.promise, clean)

    this.port.postMessage(request, transferables)

    return disposer
  }

  async requestOrThrow<T>(init: RpcRequestPreinit, transferables: Transferable[] = [], signal = Signals.never()) {
    using resolveOnResponse = this.#request<T>(init, transferables)
    using rejectOnAbort = Signals.rejectOnAbort(signal)
    const rejectOnClose = this.resolveOnClose.promise.then(r => { throw r })

    return await Promise.race([resolveOnResponse.get(), rejectOnAbort.get(), rejectOnClose])
  }

  async helloOrThrow(signal = Signals.never()) {
    this.port.start()

    const resolveOnPassive = this.resolveOnHello.promise
    using resolveOnActive = this.#request<void>({ method: "hello" })
    using rejectOnAbort = Signals.rejectOnAbort(signal)

    await Promise.race([resolveOnPassive, resolveOnActive.get(), rejectOnAbort.get()])

    this.#ping().catch(console.error)
  }

  async #ping() {
    while (true) {
      using resolveOnResponse = this.#request<void>({ method: "hello" })
      const rejectOnTimeout = new Promise((_, err) => setTimeout(err, 1000))

      try {
        await Promise.race([resolveOnResponse.get(), rejectOnTimeout])
        await new Promise(ok => setTimeout(ok, 1000))
      } catch (e: unknown) {
        this.resolveOnClose.resolve(e)
        return
      }
    }
  }

}
