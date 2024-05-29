
export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

window.addEventListener("message", async (event) => {
  console.debug(`${event.origin} -> ${location.origin}/iframe: ${event.data}`)

  if (event.data === "ping") {
    event.source?.postMessage("pong", { targetOrigin: event.origin })
    return
  }

  if (event.data === "connect") {
    const [originPort] = event.ports

    if (originPort == null)
      return

    serviceWorker.postMessage(event.origin, [originPort])
    return
  }
})

console.log(location.origin, "iframe", "started")