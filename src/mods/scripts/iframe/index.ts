
export { }

console.log(location.origin, "iframe", "startign")

await navigator.serviceWorker.register("/service_worker.js")
const serviceWorker = await navigator.serviceWorker.ready.then(r => r.active!)

window.addEventListener("message", (event) => {
  console.log(location.origin, "iframe", event.data)

  const origin = event.origin
  const [port] = event.ports

  serviceWorker.postMessage(origin, [port])
  return
})

console.log(location.origin, "iframe", "started")