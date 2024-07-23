import { BackgroundProvider } from "@/mods/comps/background";
import "@/mods/styles/globals.css";

import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <BackgroundProvider script="/service_worker.latest.js">
    <Component {...pageProps} />
  </BackgroundProvider>
}
