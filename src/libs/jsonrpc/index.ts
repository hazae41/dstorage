import { Disposer } from "@hazae41/disposer";
import { Future } from "@hazae41/future";
import { RpcCounter, RpcErr, RpcError, RpcId, RpcMethodNotFoundError, RpcOk, RpcRequest, RpcRequestInit, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc";

export type RpcMessageInit =
  | RpcRequestInit
  | RpcResponseInit

export namespace Signals {

  export function rejectOnAbort(signal: AbortSignal) {
    const rejectOnAbort = new Future<never>()

    const onAbort = () => rejectOnAbort.reject(new Error("Aborted", { cause: signal.reason }))
    const onClean = () => signal.removeEventListener("abort", onAbort)

    signal.addEventListener("abort", onAbort, { passive: true })

    return new Disposer(rejectOnAbort.promise, onClean)
  }

}

export class RpcRouter {

  readonly counter = new RpcCounter()
  readonly requests = new Map<RpcId, Future<RpcResponse<any>>>()
  readonly handlers = new Map<string, (request: RpcRequest<any>) => unknown>()

  readonly resolveOnHello = new Future<void>()
  readonly rejectOnClose = new Future<never>()

  #ready = false

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
    if (!this.#ready)
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

  #request<T>(init: RpcRequestPreinit) {
    const resolveOnResponse = new Future<RpcResponse<T>>()

    const request = this.counter.prepare(init)

    this.requests.set(request.id, resolveOnResponse)
    const clean = () => this.requests.delete(request.id)
    const disposer = new Disposer(resolveOnResponse.promise, clean)

    this.port.postMessage(JSON.stringify(request))

    return disposer
  }

  async requestOrThrow<T>(init: RpcRequestPreinit, signal = new AbortController().signal) {
    using resolveOnResponse = this.#request<T>(init)
    using rejectOnAbort = Signals.rejectOnAbort(signal)
    const rejectOnClose = this.rejectOnClose.promise

    return await Promise.race([resolveOnResponse.get(), rejectOnAbort.get(), rejectOnClose])
  }

  async helloOrThrow(signal = new AbortController().signal) {
    this.#ready = true

    const passive = this.resolveOnHello.promise
    using active = this.#request<void>({ method: "hello" })

    const close = this.rejectOnClose.promise
    using abort = Signals.rejectOnAbort(signal)

    await Promise.race([passive, active.get(), abort.get(), close])

    this.#ping().catch(console.error)
  }

  async #ping() {
    while (true) {
      const signal = AbortSignal.timeout(1000)

      using resolve = this.#request<void>({ method: "hello" })
      using reject = Signals.rejectOnAbort(signal)

      try {
        await Promise.race([resolve.get(), reject.get()])
        await new Promise(r => setTimeout(r, 1000))
      } catch (e: unknown) {
        this.rejectOnClose.reject(e)
        return
      }
    }
  }

}