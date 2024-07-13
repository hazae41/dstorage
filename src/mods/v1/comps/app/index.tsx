import { ReactNode } from "react";
import { BackgroundProvider } from "../background";

export function Layout(props: {
  readonly children?: ReactNode
}) {
  const { children } = props

  return <BackgroundProvider>
    {children}
  </BackgroundProvider>
}


