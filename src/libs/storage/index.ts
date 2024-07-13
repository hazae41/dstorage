export namespace Kv {

  export async function ask(caches: CacheStorage, origin: string, scope: string) {
    if (scope === "meta")
      throw new Error("Not allowed")

    const cache = await caches.open(scope)

    const allowedUrl = new URL("/allowed", "http://meta")
    allowedUrl.searchParams.set("origin", origin)
    const allowedReq = new Request(allowedUrl)
    const allowedRes = await cache.match(allowedReq)

    if (allowedRes == null)
      throw new Error("Not allowed")

    return
  }

  export async function allow(caches: CacheStorage, origin: string, scope: string, capacity: number) {
    if (scope === "meta")
      throw new Error("Not allowed")

    const cache = await caches.open(scope)

    const allowedUrl = new URL("/allowed", "http://meta")
    allowedUrl.searchParams.set("origin", origin)
    const allowedReq = new Request(allowedUrl)
    const allowedRes = new Response()

    await cache.put(allowedReq, allowedRes)

    const capacityUrl = new URL("/capacity", "http://meta")
    const capacityReq = new Request(capacityUrl)

    const oldCapacityRes = await cache.match(capacityReq)
    const oldCapacityNum = oldCapacityRes == null ? 0 : await oldCapacityRes.json() as number

    const newCapacityNum = capacity
    const newCapacityRes = new Response(JSON.stringify(newCapacityNum))

    if (newCapacityNum > oldCapacityNum)
      await cache.put(capacityReq, newCapacityRes)

    return
  }

  export async function get(caches: CacheStorage, origin: string, scope: string, request: Request) {
    if (scope === "meta")
      throw new Error("Not allowed")

    const cache = await caches.open(scope)

    const valueReq = request
    const valueUrl = new URL(valueReq.url)

    if (valueUrl.origin === "http://meta")
      throw new Error("Not allowed")

    const allowedUrl = new URL("/allowed", "http://meta")
    allowedUrl.searchParams.set("origin", origin)
    const allowedReq = new Request(allowedUrl)
    const allowedRes = await cache.match(allowedReq)

    if (allowedRes == null)
      throw new Error("Not allowed")

    const valueRes = await cache.match(valueReq)

    if (valueRes == null)
      return

    return valueRes
  }

  export async function set(caches: CacheStorage, origin: string, scope: string, request: Request, response: Response) {
    if (scope === "meta")
      throw new Error("Not allowed")

    const cache = await caches.open(scope)

    const valueReq = request
    const valueUrl = new URL(valueReq.url)

    if (valueUrl.origin === "http://meta")
      throw new Error("Not allowed")

    const allowedUrl = new URL("/allowed", "http://meta")
    allowedUrl.searchParams.set("origin", origin)
    const allowedReq = new Request(allowedUrl)
    const allowedRes = await cache.match(allowedReq)

    if (allowedRes == null)
      throw new Error("Not allowed")

    const oldValueRes = await cache.match(valueReq)
    const oldValueSize = oldValueRes == null ? 0 : await oldValueRes.arrayBuffer().then(r => r.byteLength)

    const newValueRes = response
    const newValueSize = await newValueRes.clone().arrayBuffer().then(r => r.byteLength)

    const sizeUrl = new URL("/size", "http://meta")
    const sizeReq = new Request(sizeUrl)

    const oldSizeRes = await cache.match(sizeReq)
    const oldSizeNum = oldSizeRes == null ? 0 : await oldSizeRes.json() as number

    const newSizeNum = oldSizeNum - oldValueSize + newValueSize

    const capacityUrl = new URL("/capacity", "http://meta")
    const capacityReq = new Request(capacityUrl)
    const capacityRes = await cache.match(capacityReq)
    const capacityNum = capacityRes == null ? 0 : await capacityRes.json() as number

    if (newSizeNum > capacityNum)
      throw new Error("Too big")

    await cache.put(valueReq, newValueRes)
    await cache.put(sizeReq, new Response(JSON.stringify(newSizeNum)))

    return
  }

}