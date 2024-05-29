
export { }

declare const self: ServiceWorkerGlobalScope

console.log(location.origin, "service_worker", "starting")

self.addEventListener("message", (event) => {
  console.log(location.origin, "service_worker", event.data)

  const [originPort] = event.ports

  originPort.addEventListener("message", (event) => {
    console.log(location.origin, "service_worker", event.data)
  })

  originPort.start()
})

console.log(location.origin, "service_worker", "started")

self.skipWaiting()