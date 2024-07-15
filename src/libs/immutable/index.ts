import { Nullable } from "@hazae41/option"

declare const FILES_AND_HASHES: Nullable<[string, string][]>

export class InvalidSha256HashError extends Error {

  constructor(
    /**
     * Absolute url
     */
    readonly url: string,

    /**
     * Expected hash
     */
    readonly expected: string,

    /**
     * Received hash
     */
    readonly received: string
  ) {
    super(`Invalid SHA-256 hash for ${url}. Expected ${expected} but received ${received}.`)
  }

}

export namespace Immutable {

  export const files = typeof FILES_AND_HASHES !== "undefined"
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

    for (const [file, hash] of files)
      promises.push(defetch(new Request(file), hash))

    await Promise.all(promises)
  }

  /**
   * Match or fetch and cache
   * @param request 
   * @param expected 
   * @returns 
   */
  export async function defetch(request: Request, expected: string) {
    const cache = await caches.open("meta")

    /**
     * Check cache if possible
     */
    if (request.cache !== "reload") {
      const cached = await cache.match(request)

      if (cached != null)
        /**
         * Found
         */
        return cached

      /**
       * Not found
       */
    }

    /**
     * Fetch but skip cache-control
     */
    const fetched = await fetch(request, { cache: "reload" })

    /**
     * Remove junk properties e.g. redirected
     */
    const cleaned = new Response(fetched.body, fetched)

    /**
     * Errors are not verified nor cached
     */
    if (!cleaned.ok)
      return cleaned

    const receivedHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await cleaned.clone().arrayBuffer()))
    const receivedHashRawHex = Array.from(receivedHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const received = receivedHashRawHex

    if (received !== expected)
      throw new InvalidSha256HashError(request.url, expected, received)

    cache.put(request, cleaned.clone())

    return cleaned
  }

  /**
   * Handle fetch event
   * @param event 
   * @returns 
   */
  export function handle(event: FetchEvent) {
    if (process.env.NODE_ENV === "development")
      return

    /**
     * Match exact
     */
    const url = new URL(event.request.url)

    const hash = files.get(url.pathname)

    if (hash != null) {
      /**
       * Do magic
       */
      event.respondWith(defetch(event.request, hash))

      /**
       * Found
       */
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

      const hash = files.get(url.pathname)

      if (hash != null) {
        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url, request0)

        /**
         * Do magic
         */
        event.respondWith(defetch(request1, hash))

        /**
         * Found
         */
        return
      }
    }

    /**
     * Match /index.html
     */
    {
      const url = new URL(event.request.url)

      url.pathname += "/index.html"

      const hash = files.get(url.pathname)

      if (hash != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url, request0)

        /**
         * Do magic
         */
        event.respondWith(defetch(request1, hash))

        /**
         * Found
         */
        return
      }
    }

    /**
     * Not found
     */
    return
  }

}