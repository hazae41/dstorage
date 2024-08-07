import { RpcRouter } from "@/libs/jsonrpc"
import { ChildrenProps } from "@/libs/react"
import { Immutable } from "@hazae41/immutable"
import { Nullable, Option } from "@hazae41/option"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

export interface Background {
  readonly router: RpcRouter
  readonly worker: ServiceWorker
  readonly update?: Nullable<() => Promise<void>>
}

export const BackgroundContext = createContext<Nullable<Background>>(undefined)

export function useBackgroundContext() {
  return Option.wrap(useContext(BackgroundContext))
}

export function BackgroundProvider(props: ChildrenProps) {
  const { children } = props

  const [background, setBackground] = useState<Background>()

  const connectOrThrow = useCallback(async () => {
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

    const update = await Immutable.register("/service_worker.latest.js")

    /**
     * Auto-update for now
     */
    if (update != null) {
      await update()
      return
    }

    const worker = await navigator.serviceWorker.ready.then(r => r.active)

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