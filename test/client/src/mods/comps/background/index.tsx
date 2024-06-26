import { RpcRouter } from "@/libs/jsonrpc"
import { Future } from "@hazae41/future"
import { Nullable } from "@hazae41/option"
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react"

export interface Background {
  readonly router: RpcRouter
  readonly worker: ServiceWorker
  readonly update?: () => Promise<void>
}

export const BackgroundContext = createContext<Nullable<Background>>(undefined)

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
    const bricked = JsonLocalStorage.get("service_worker.bricked")

    if (bricked)
      throw new Error(`This website is bricked`)

    /**
     * Get previous registration
     */
    const registration = await navigator.serviceWorker.getRegistration()

    /**
     * Update detection is not foolproof but acts as a canary for administrators and other users
     */
    registration?.addEventListener("updatefound", async () => {
      const { installing } = registration

      if (installing == null)
        return

      const currentHashRawHex = JsonLocalStorage.get("service_worker.current.hashRawHex")
      const pendingHashRawHex = JsonLocalStorage.get("service_worker.pending.hashRawHex")

      installing.addEventListener("statechange", async () => {
        if (installing.state !== "installed")
          return
        JsonLocalStorage.set("service_worker.pending.hashRawHex", undefined)
      })

      /**
       * An update was pending and solicited
       */
      if (pendingHashRawHex === currentHashRawHex)
        return

      console.warn(`Unsolicited service worker update detected`)

      /**
       * Only clear synchronous storage as we must be faster than the service worker
       */
      localStorage.clear()
      sessionStorage.clear()

      /**
       * Asynchronous storages should be encrypted or contain only public data
       */

      console.warn(`Successfully cleared storage`)

      /**
       * Unregister service worker to prevent further attacks
       */
      registration.unregister()

      console.warn(`Successfully unregistered service worker`)

      /**
       * Enter brick mode
       */
      JsonLocalStorage.set("service_worker.bricked", true)

      console.warn(`Successfully entered brick mode`)

      while (true)
        alert(`An unsolicited update attack was detected. Your storage has been safely erased. Please report this incident urgently. Please do not use this website (${location.origin}) anymore. Please close this page.`)

      /**
       * Page should be closed by now
       */
      return
    })

    const latestRes = await fetch("/service_worker.js", { cache: "reload" })

    if (!latestRes.ok)
      throw new Error(`Failed to fetch latest service worker`)

    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestRes.arrayBuffer()))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const currentHashRawHex = JsonLocalStorage.getOrSet("service_worker.current.hashRawHex", latestHashRawHex)

    await navigator.serviceWorker.register(`/${currentHashRawHex}.h.js`, { updateViaCache: "all" })

    /**
     * No update found
     */
    if (currentHashRawHex === latestHashRawHex)
      return

    return async () => {
      const registration = await navigator.serviceWorker.getRegistration()

      if (registration == null)
        return

      const { active } = registration

      if (active == null)
        return

      const currentHashRawHex = JsonLocalStorage.get("service_worker.current.hashRawHex")

      /**
       * Recheck to avoid concurrent updates
       */
      if (currentHashRawHex === latestHashRawHex)
        return

      JsonLocalStorage.set("service_worker.current.hashRawHex", latestHashRawHex)
      JsonLocalStorage.set("service_worker.pending.hashRawHex", latestHashRawHex)

      const future = new Future<void>()

      active.addEventListener("statechange", async () => {
        if (active.state !== "redundant")
          return
        future.resolve()
      })

      await navigator.serviceWorker.register(`/${latestHashRawHex}.h.js`, { updateViaCache: "all" })
      await future.promise
    }
  }

}

export function BackgroundProvider(props: {
  readonly children?: ReactNode
}) {
  const { children } = props

  const [background, setBackground] = useState<Background>()

  const connectOrThrow = useCallback(async () => {
    const update = await StickyServiceWorker.register()

    const worker = await navigator.serviceWorker.ready.then(r => r.active)

    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

    if (worker == null)
      return

    const channel = new MessageChannel()
    const router = new RpcRouter(channel.port1)

    worker.postMessage([{ method: "connect" }], [channel.port2])

    await router.helloOrThrow(AbortSignal.timeout(1000))

    const background = { router, worker, update }

    setBackground(background)

    router.resolveOnClose.promise.then(() => setBackground(current => {
      if (current !== background)
        return current
      return undefined
    }))
  }, [])

  useEffect(() => {
    connectOrThrow().catch(console.error)
  }, [connectOrThrow])

  const pingOrThrow = useCallback(async () => {
    if (background == null)
      return
    background.worker.postMessage([{ method: "ping" }])
  }, [background])

  useEffect(() => {
    if (background == null)
      return

    const i = setInterval(() => pingOrThrow(), 1000)

    return () => clearInterval(i)
  }, [background, pingOrThrow])

  if (background == null)
    return null

  return <BackgroundContext.Provider value={background}>
    {children}
  </BackgroundContext.Provider>
}