import "@/mods/styles/globals.css";
import { HashPathProvider } from "@hazae41/chemin";

import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return <>
    <Head>
      <title>DStorage</title>
      <link rel="manifest" href="/manifest.json" />
    </Head>
    <HashPathProvider>
      <Component {...pageProps} />
    </HashPathProvider>
  </>
}


