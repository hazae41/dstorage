
export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

window.addEventListener("message", (event) => {
  console.log(location.origin, "iframe", event.data)

  const origin = event.origin
  const [port] = event.ports

  /**
   * ServiceWorker APIs (e.g. IndexedDB)
   */
  if (event.data === "service_worker") {
    serviceWorker.postMessage(origin, [port])
    return
  }

  /**
   * Page APIs (e.g. localStorage)
   */
  if (event.data === "iframe") {
    /**
     * NOOP
     */

    return
  }

})

console.log(location.origin, "iframe", "started")