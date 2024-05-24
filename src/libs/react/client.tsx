import { ReactNode, useEffect, useState } from "react";

export function Client(props: {
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