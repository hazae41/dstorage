export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

self.addEventListener("message", (event) => {
  console.log(location.origin, "service_worker", event.data)

  const port = event.ports[0]

  port.addEventListener("message", (event) => {
    /**
     * Echo
     */
    port.postMessage(event.data)
  })

  port.start()
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()