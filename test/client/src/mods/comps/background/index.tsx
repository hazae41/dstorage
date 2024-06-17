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

export function BackgroundProvider(props: {
  readonly children?: ReactNode
}) {
  const { children } = props

  const [background, setBackground] = useState<RpcRouter>()

  const connectOrThrow = useCallback(async () => {
    const channel = new MessageChannel()

    await navigator.serviceWorker.register("/service_worker.js", { updateViaCache: "all" })
    const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

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