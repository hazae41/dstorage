import { Nullable } from "@hazae41/option"

export namespace RequestLike {

  export function into(req: RequestLike) {
    return new Request(req.url, req)
  }

}

export interface RequestLike extends RequestInit {
  readonly url: RequestInfo | URL
}

export namespace ResponseLike {

  export function into(res: ResponseLike) {
    return new Response(res.body, res)
  }

}

export interface ResponseLike extends ResponseInit {
  readonly body?: Nullable<BodyInit>
}
