# DStorage

Proof-of-concept of a public and secure origin-bound storage for your origin-less apps.

## Why

This allows your website to use the storage (localStorage, IndexedDB, WebAuthn) of another origin.

This is particularily useful when your website doesn't have a single origin.

For example, if you use the same app from multiple origins (e.g. browser extensions, mobile webviews).

Or if you want maximum decentralization by allowing multiple origins to operate on the same storage (e.g. IPFS websites).

For example, allowing both https://myapp.ipfs.io and https://myapp.example.com to have the same storage.

Or you just want some basic versioning like https://1.myapp.org and https://2.myapp.org.

## Communication

A few modes of cross-origin communication are available depending on your use-case.

### Service-worker to service-worker (recommended)

If you need APIs available on a service-worker (e.g. IndexedDB), you can use this mode.

You can use cross-origin service-worker to service-worker communication bootstrapped by an iframe.

You just need a page to bootstrap the communication from your service-worker to the other service-worker.

This communication continues to work even a few seconds after all pages are closed (~30 seconds on Chromium).

When the communication is closed, just reopen a new bootstrap page.

### Page to service-worker

This is the same as above but this time the communication is closed once you close the page.

## APIs

All communication is done via JSON-RPC 2.0.

### Example

Given the function

```tsx
function example(value: boolean): void
```

You can call it with

```tsx
port.postMessage({ jsonrpc: "2.0", id: 123, method: "example", params: [true] })
```

And get the result with

```tsx
const { id, result, error } = event.data
```

### KeyVal

This is a key-value storage using Cache API.

The access is scoped by user-interaction

```tsx
function kv_ask(name: string): void
```

This will ask user-interaction for access to `name`

```tsx
function kv_set(name: string, key: string, value: BodyInit): void
```

This will set `key` to `value` in `name`

```tsx
function kv_get(name: string, key: string): unknown
```

This will return `value` from `key` in `name`

### WebAuthn KV

This is a key-value storage using WebAuthn.

This will open a page requiring user confirmation.

```tsx
function webAuthn_kv_set(name: string, key: string, value: Nullable<Uint8Array>): void
```

```tsx
function webAuthn_kv_get(name: string, key: string): unknown
```

## Limitations

The main limitation is storage availability. 

On some browsers the storage is not persistent unless the user adds the storage website to his favorites.

Also, as explained below, an attacker can try to fill the storage with random stuff until it's full.

This can be mitigated by only allowing a limited storage from user-approved origins using a confirmation page.

This can make the UX worse than just using a local storage, but can prevent phishing because a new origin will show a warning.

## Security

Since all operation are cross-origin through JSON-like messages, there is no much security risk as the browser sandboxes everything.

### Attacker from a third-party website

All storages do not have discoverability, so there is no risk of an attacker seeing or tampering with the data. 

He would need to know the storage keys of the data.

Bruteforce is not viable if you use strong random-like keys like UUIDs or hashes.

Even if he can guess the keys, assuming your data is strongly encrypted, he would only be able to delete that data.

Another possible attack is filling the storage with random stuff to cause the storage to be full.

This can be mitigated by the storage website; only allowing a limited storage from user-approved origins.

### Attacker from the storage website

If the storage website is compromised (supply-chain, DNS, BGP attack), there is not much it can do.

Assuming your data is strongly encrypted, it can't do anything beside deleting that data or refusing to serve it.

### Attacker from your website

If your own website is compromised then the storage is probably available to the attacker, just like any local storage.

You can somewhat mitigate this by encrypting your data using an user-provided password or some WebAuthn authentication.

## Protocols

### D-JSON-RPC (UDP-like multicast-like communication)

This is used via `postMessage` by pages (and iframes) and service-workers before a `MessagePort` is shared

#### Format

This is like JSON-RPC but there is no request-response

There are only JSON messages using the following format

```tsx
{
  method: string,
  params: unknown
}
```

#### ping

Perform a ping to ensure the target is available for a `connect` or `connect2`

Only used for page targets as for service-worker targets we can use `serviceWorker.ready` heuristic

```tsx
{
  method: "ping"
}
```

The target is available if a `pong` is received

- Why use `ping` when there is already `hello`?

A `ping` can be sent from/to a middlebox whereas `hello` is always sent end-to-end 

- Why don't use a `connected` or `connected2` reply?

Because all communication here is multicast-like so a `connected` may trigger others

#### pong

Reply to a `ping`

```tsx
{
  method: "pong"
}
```

#### connect

Establish an end-to-end communication to the target

```tsx
{
  method: "connect"
}
```

The message also contains a `MessagePort` to use as a bidirectional port

#### connect2

Establish an end-to-end communication to the target's service-worker

```tsx
{
  method: "connect2"
}
```

The message also contains a `MessagePort` to use as a bidirectional port

#### connect3

Sent by a page to its service-worker after a `connect2`

```tsx
{
  method: "connect3",
  params: [trueOrigin]
}
```

The message also contains a `MessagePort` to use as a bidirectional port

### JSON-RPC (TCP-like unicast-like communication)

Once a end-to-end communication is established via `MessagePort`

#### hello

Perform a fast bidirectional active-passive handshake to ensure the target is available

```tsx
{
  method: "hello"
}
```

The connection is ready when both sides received either a `hello` request or a `hello` response