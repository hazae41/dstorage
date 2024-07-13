import { Nullable } from "@hazae41/option"

export namespace Immutable {

  declare const FILES_AND_HASHES: Nullable<[string, string][]>

  const filesAndHashes = typeof FILES_AND_HASHES !== "undefined"
    ? new Map(FILES_AND_HASHES)
    : new Map()

  /**
   * Uncache all files
   */
  export async function uncache() {
    await caches.delete("meta")
  }

  /**
   * Fetch and cache all files
   * @returns 
   */
  export async function precache() {
    if (process.env.NODE_ENV === "development")
      return

    const promises = new Array<Promise<Response>>()

    for (const [file, hash] of filesAndHashes) {
      const url = new URL(file, location.origin)

      if (!url.pathname.split("/").at(-1)!.includes("."))
        url.pathname += ".html"

      promises.push(defetch(new Request(url), hash))
    }

    await Promise.all(promises)
  }

  /**
   * Match or fetch and cache
   * @param request 
   * @param hash 
   * @returns 
   */
  export async function defetch(request: Request, hash: string) {
    const cache = await caches.open("meta")

    /**
     * Check cache if not force reloaded
     */
    if (request.cache !== "reload") {
      const cached = await cache.match(request)

      if (cached != null)
        return cached

      /**
       * Not found in cache
       */
    }

    /**
     * Fetch but force reload
     */
    const fetched = await fetch(request, { cache: "reload" })

    /**
     * Errors are not verified nor cached
     */
    if (!fetched.ok)
      return fetched

    const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await fetched.clone().arrayBuffer()))
    const hashRawHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    if (hashRawHex !== hash)
      throw new Error("Invalid hash")

    cache.put(request, fetched.clone())

    return fetched
  }

  /**
   * Handle fetch event
   * @param event 
   * @returns 
   */
  export function handle(event: FetchEvent) {
    if (process.env.NODE_ENV === "development")
      return

    const url = new URL(event.request.url)

    /**
     * Match exact
     */
    if (filesAndHashes.has(url.pathname)) {
      const hash = filesAndHashes.get(url.pathname)

      event.respondWith(defetch(event.request, hash))

      return
    }

    /**
     * Not a directory
     */
    if (url.pathname.split("/").at(-1)!.includes("."))
      /**
       * Not found
       */
      return

    /**
     * Match .html
     */
    {
      const url = new URL(event.request.url)

      url.pathname += ".html"

      if (filesAndHashes.has(url.pathname)) {
        const hash = filesAndHashes.get(url.pathname)

        const request = new Request(url, event.request)

        event.respondWith(defetch(request, hash))

        return
      }
    }

    /**
     * Match /index.html
     */
    {
      const url = new URL(event.request.url)

      url.pathname += "/index.html"

      if (filesAndHashes.has(url.pathname)) {
        const hash = filesAndHashes.get(url.pathname)

        const request = new Request(url, event.request)

        event.respondWith(defetch(request, hash))

        return
      }
    }

    /**
     * Not found
     */
    return
  }

}