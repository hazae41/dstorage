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
  readonly rejectOnClose = new Future<never>()

  #ready = false

  constructor(
    readonly port: MessagePort
  ) {
    const onMessage = this.#onMessage.bind(this)

    port.addEventListener("message", onMessage, { passive: true })

    this.rejectOnClose.promise.then(() => {
      port.removeEventListener("message", onMessage)
      port.close()
    })
  }

  async #onMessage(event: MessageEvent) {
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
        this.rejectOnClose.reject(e)
        return
      }
    }
  }

}

export class WindowMessenger {

  constructor(
    readonly window: Window,
    readonly origin: string
  ) { }

  async connectOrThrow(method: string, signal = new AbortController().signal) {
    const channel = new MessageChannel()

    const selfPort = channel.port1
    const targetPort = channel.port2

    const router = new RpcRouter(selfPort)

    while (!signal.aborted) {
      try {
        const hello = router.helloOrThrow(Signals.merge(signal, AbortSignal.timeout(100)))
        this.window.postMessage(JSON.stringify({ method }), this.origin, [targetPort])
        await hello

        return router
      } catch { }
    }

    signal.throwIfAborted()
    throw new Error()
  }

}