import { RpcRouter } from "@/libs/jsonrpc"
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

  export function set<T>(key: string, value: Nullable<T>) {
    if (value != null)
      localStorage.setItem(key, JSON.stringify(value))
    else
      localStorage.removeItem(key)
  }

  export function get<T>(key: string): Nullable<T> {
    const value = localStorage.getItem(key)

    if (value == null)
      return value

    return JSON.parse(value) as T
  }

  export function getAndSet<T>(key: string, newValue: T) {
    const currentValue = get<T>(key)

    set(key, newValue)

    return currentValue
  }

  export function getOrSet<T>(key: string, defaultValue: Nullable<T>) {
    const currentValue = get<T>(key)

    if (currentValue != null)
      return currentValue

    set(key, defaultValue)

    return defaultValue
  }

}

export namespace StickyServiceWorker {

  export async function register() {
    const registration = await navigator.serviceWorker.getRegistration()

    registration?.addEventListener("updatefound", async () => {
      const pendingHashRawHex = JsonLocalStorage.getAndSet("service_worker.pending.hashRawHex", undefined)

      if (pendingHashRawHex != null)
        return

      console.warn(`Unsolicited service worker update detected`)

      localStorage.clear()
      sessionStorage.clear()

      console.warn(`Successfully cleared storage`)

      registration.unregister()

      console.warn(`Successfully unregistered service worker`)

      while (true)
        alert(`An unsolicited update attack was detected. Your storage has been safely erased. Please report this incident urgently. Please do not use this website anymore. Please close this page.`)

      return
    })

    const latestRes = await fetch("/service_worker.js", { cache: "reload" })
    const latestBytes = new Uint8Array(await latestRes.arrayBuffer())
    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", latestBytes))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const currentHashRawHex = JsonLocalStorage.getOrSet("service_worker.current.hashRawHex", latestHashRawHex)

    await navigator.serviceWorker.register(`/${currentHashRawHex}.h.js`, { updateViaCache: "all" })

    if (currentHashRawHex === latestHashRawHex)
      return

    return () => {
      JsonLocalStorage.set("service_worker.current.hashRawHex", latestHashRawHex)
      JsonLocalStorage.set("service_worker.pending.hashRawHex", latestHashRawHex)
    }
  }

}

export function BackgroundProvider(props: {
  readonly children?: ReactNode
}) {
  const { children } = props

  const [background, setBackground] = useState<RpcRouter>()

  const connectOrThrow = useCallback(async () => {
    const channel = new MessageChannel()

    const update = await StickyServiceWorker.register()

    /**
     * Reload if a new service worker is installed during the session
     */
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

    const serviceWorker = navigator.serviceWorker.controller!

    const backgroundRouter = new RpcRouter(channel.port1)

    serviceWorker.postMessage([{ method: "connect" }], [channel.port2])

    await backgroundRouter.helloOrThrow(AbortSignal.timeout(1000));

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