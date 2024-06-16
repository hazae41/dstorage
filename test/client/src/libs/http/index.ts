import { Nullable } from "@hazae41/option"

export interface RequestLike extends RequestInit {
  readonly url: RequestInfo | URL
}

export interface ResponseLike extends ResponseInit {
  readonly body?: Nullable<BodyInit>
}

export class TransferableRequest extends Request {

  #headers: JsonHeaders

  constructor(
    input: RequestInfo,
    init?: RequestInit
  ) {
    super(input, init)

    this.#headers = JsonHeaders.from(super.headers)
  }

  static from(request: Request) {
    if (request instanceof TransferableRequest)
      return request
    return new TransferableRequest(request.url, request)
  }

  get transferables(): Transferable[] {
    if (this.body == null)
      return []
    return [this.body]
  }

  /**
   * @override
   */
  get headers() {
    return this.#headers
  }

  toJSON() {
    return {
      url: this.url,
      method: this.method,
      headers: this.headers.toJSON(),
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      mode: this.mode,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      integrity: this.integrity,
      keepalive: this.keepalive,
      body: this.body,
    }
  }

}

export class TransferableResponse extends Response {

  #headers: JsonHeaders

  constructor(
    body?: Nullable<BodyInit>,
    init?: ResponseInit
  ) {
    super(body, init)

    this.#headers = JsonHeaders.from(super.headers)
  }

  static from(response: Response) {
    if (response instanceof TransferableResponse)
      return response
    return new TransferableResponse(response.body, response)
  }

  get transferables(): Transferable[] {
    if (this.body == null)
      return []
    return [this.body]
  }

  /**
   * @override
   */
  get headers() {
    return this.#headers
  }

  toJSON() {
    return {
      body: this.body,
      headers: this.headers.toJSON(),
      status: this.status,
      statusText: this.statusText,
    }
  }

}

export class JsonHeaders extends Headers {

  constructor(
    init?: HeadersInit
  ) {
    super(init)
  }

  static from(headers: Headers) {
    if (headers instanceof JsonHeaders)
      return headers
    return new JsonHeaders(headers)
  }

  toJSON() {
    const record: Record<string, string> = {}
    this.forEach((value, key) => record[key] = value)
    return record
  }

}