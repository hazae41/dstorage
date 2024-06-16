import { Nullable } from "@hazae41/option"

export interface RequestLike extends RequestInit {
  readonly url: RequestInfo | URL
}

export interface ResponseLike extends ResponseInit {
  readonly body?: Nullable<BodyInit>
}

export class TransferableRequest extends Request {

  constructor(
    input: RequestInfo,
    init?: RequestInit
  ) {
    super(input, init)
  }

  get transferables(): Transferable[] {
    if (this.body == null)
      return []
    return [this.body]
  }

  toJSON() {
    return {
      url: this.url,
      method: this.method,
      headers: this.headers,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      mode: this.mode,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      integrity: this.integrity,
      keepalive: this.keepalive,
      signal: this.signal,
      body: this.body,
    }
  }

}

export class TransferableResponse extends Response {

  constructor(
    body?: Nullable<BodyInit>,
    init?: ResponseInit
  ) {
    super(body, init)
  }

  get transferables(): Transferable[] {
    if (this.body == null)
      return []
    return [this.body]
  }

  toJSON() {
    return {
      body: this.body,
      headers: this.headers,
      status: this.status,
      statusText: this.statusText,
    }
  }

}