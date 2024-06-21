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
      // return

      const pendingHashRawHex = JsonLocalStorage.getAndSet("service_worker.pending.hashRawHex", undefined)

      if (pendingHashRawHex != null)
        return
      console.warn(`Unexpected service worker update detected`)

      localStorage.clear()
      sessionStorage.clear()

      console.warn(`Successfully cleared storage`)

      registration.unregister()

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("Controller changed")
      })

      console.warn(`Successfully unregistered service worker`)

      while (true) {
        const start = Date.now()

        alert(`An unexpected update attack was detected. Your storage has been safely erased. Please report this incident urgently. Please do not use this website anymore.`)

        if (Date.now() - start > 1000)
          break
        continue
      }

      location.assign("about:blank")
    })

    const updatedRes = await fetch("/service_worker.js", { cache: "reload" })
    const updatedBytes = new Uint8Array(await updatedRes.arrayBuffer())
    const updatedHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", updatedBytes))
    const updatedHashRawHex = Array.from(updatedHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const currentHashRawHex = JsonLocalStorage.getOrSet("service_worker.current.hashRawHex", updatedHashRawHex)

    await navigator.serviceWorker.register(`/service_worker.proxy.js?hash=${currentHashRawHex}`, { updateViaCache: "all" })

    if (currentHashRawHex === updatedHashRawHex)
      return

    return () => {
      JsonLocalStorage.set("service_worker.pending.hashRawHex", updatedHashRawHex)
      JsonLocalStorage.set("service_worker.current.hashRawHex", updatedHashRawHex)
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

    const version = await backgroundRouter.requestOrThrow<number>({
      method: "sw_version"
    }).then(([r]) => r.unwrap());

    (window as any).version = version;
    (window as any).update = update;

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