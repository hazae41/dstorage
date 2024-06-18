import { RpcRouter } from "@/libs/jsonrpc"
import { Future } from "@hazae41/future"
import { Nullable } from "@hazae41/option"
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react"

export const BackgroundContext = createContext<Nullable<RpcRouter>>(undefined)

export function useBackgroundContext() {
  const context = useContext(BackgroundContext)

  if (context == null)
    throw new Error("BackgroundContext is not provided")

  return context
}

export namespace JsonLocalStorage {

  export function set<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  export function get<T>(key: string) {
    const value = localStorage.getItem(key)

    if (value == null)
      return value

    return JSON.parse(value) as T
  }

  export function getOrSet<T>(key: string, defaultValue: T) {
    const currentValue = get<T>(key)

    if (currentValue != null)
      return currentValue

    set(key, defaultValue)

    return defaultValue
  }

}

export namespace StickyServiceWorker {

  export async function register(basePath: string) {
    const updatedRes = await fetch(basePath, { cache: "reload" })
    const updatedBytes = new Uint8Array(await updatedRes.arrayBuffer())
    const updatedHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", updatedBytes))
    const updatedHashRawHex = Array.from(updatedHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const currentHashRawHex = JsonLocalStorage.getOrSet("service_worker.current.hashRawHex", updatedHashRawHex)

    const registration = await navigator.serviceWorker.register(`${basePath}?nonce=${currentHashRawHex}`, { updateViaCache: "all" })

    registration.addEventListener("updatefound", () => console.warn("Service worker was updated"))

    const { installing } = registration

    /**
     * Wait if a new service worker is installing right now
     */
    if (installing != null) {
      const future = new Future<void>()

      const onStateChange = (e: Event) => {
        if (installing.state !== "activated")
          return
        future.resolve()
      }

      const onError = (e: ErrorEvent) => {
        future.reject(e.error)
      }

      try {
        installing.addEventListener("statechange", onStateChange)
        installing.addEventListener("error", onError)

        await future.promise
      } finally {
        installing.removeEventListener("statechange", onStateChange)
        installing.removeEventListener("error", onError)
      }
    }

    /**
     * Reload if a new service worker is installed during the session
     */
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

    if (currentHashRawHex === updatedHashRawHex)
      return

    JsonLocalStorage.set("service_worker.pending.hashRawHex", updatedHashRawHex)
    return () => JsonLocalStorage.set("service_worker.current.hashRawHex", updatedHashRawHex)
  }

}

export function BackgroundProvider(props: {
  readonly children?: ReactNode
}) {
  const { children } = props

  const [background, setBackground] = useState<RpcRouter>()

  const connectOrThrow = useCallback(async () => {
    const channel = new MessageChannel()

    const update = await StickyServiceWorker.register(`/service_worker.js`)

    if (update != null)
      console.log(`Update available`, () => update())

    const serviceWorker = navigator.serviceWorker.controller!

    const backgroundRouter = new RpcRouter(channel.port1)

    serviceWorker.postMessage([{ method: "connect" }], [channel.port2])

    await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000))

    setBackground(backgroundRouter)

    backgroundRouter.resolveOnClose.promise.then(() => setBackground(undefined))
  }, [])

  useEffect(() => {
    connectOrThrow().catch(console.error)
  }, [connectOrThrow])

  if (background == null)
    return null

  return <BackgroundContext.Provider value={background}>
    {children}
  </BackgroundContext.Provider>
}