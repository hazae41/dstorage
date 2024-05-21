export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

window.addEventListener("message", (event) => {
  console.log(location.origin, "iframe", event.data)

  const port = event.ports[0]

  if (event.data === "service_worker") {
    serviceWorker.postMessage("hello", [port])
    return
  }

  if (event.data === "iframe") {
    port.addEventListener("message", async (event) => {
      if (event.data === "set") {
        // TODO
        return
      }

      if (event.data === "get") {
        // TODO
        return
      }
    })

    port.start()
    return
  }

})

console.log(location.origin, "iframe", "started")