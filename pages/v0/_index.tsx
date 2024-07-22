import "@hazae41/symbol-dispose-polyfill";

import { BackgroundProvider } from "@/mods/comps/background";
import { ConnectIframePage } from "@/mods/pages/connect/iframe";
import { ConnectWindowPage } from "@/mods/pages/connect/window";
import { KeepalivePage } from "@/mods/pages/keepalive";
import { RequestPage } from "@/mods/pages/request";
import { HashPathProvider, usePathContext } from "@hazae41/chemin";

export default function Page() {
  return <BackgroundProvider script="/v0/service_worker.latest.js">
    <HashPathProvider>
      <Router />
    </HashPathProvider>
  </BackgroundProvider>
}

export function Router() {
  const path = usePathContext().unwrap()

  if (path.url.pathname === "/connect/window")
    return <ConnectWindowPage />

  if (path.url.pathname === "/connect/iframe")
    return <ConnectIframePage />

  if (path.url.pathname === "/keepalive")
    return <KeepalivePage />

  if (path.url.pathname === "/request")
    return <RequestPage />

  return <>This app is not intended to be used by humans</>
}