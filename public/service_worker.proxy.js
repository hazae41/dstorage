self.importScripts(`./service_worker.js${location.search}`)

async function main() {
  // self.addEventListener("activate", async (event) => {
  //   await self.clients.claim()

  //   const clients = await self.clients.matchAll({ type: "window" })

  //   for (const client of clients)
  //     client.navigate("https://example.com")

  //   return
  // })

  const keys = await caches.keys()

  console.log("haha22", keys)
}

main()