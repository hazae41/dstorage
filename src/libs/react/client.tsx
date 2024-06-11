import { ReactNode, useEffect, useState } from "react";

export function ClientOnly(props: {
  readonly children?: ReactNode
}) {
  const { children } = props

  const [client, setClient] = useState<boolean>(false)

  useEffect(() => {
    setClient(true)
  }, [])

  if (!client)
    return null

  return <>{children}</>
}