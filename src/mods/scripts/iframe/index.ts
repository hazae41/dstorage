export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

window.addEventListener("message", (event) => {
  console.log(location.origin, "iframe", event.data)

  const port = event.ports[0]

  /**
   * ServiceWorker APIs (e.g. IndexedDB)
   */
  if (event.data === "service_worker") {
    serviceWorker.postMessage("hello", [port])
    return
  }

  /**
   * Page APIs (e.g. localStorage)
   */
  if (event.data === "iframe") {
    port.addEventListener("message", async (event) => {
      if (event.data === "localStorage.set") {
        // TODO
        return
      }

      if (event.data === "localStorage.get") {
        // TODO
        return
      }
    })

    port.start()
    return
  }

})

console.log(location.origin, "iframe", "started")