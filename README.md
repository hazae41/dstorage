# DStorage

Proof-of-concept of a public and secure origin-bound storage for your origin-less apps (e.g. IPFS).

## Why

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

### Page to iframe

When some APIs are not available on the other service-worker (e.g. localStorage), you can communicate directly with the iframe.

The communication is lost when the iframe (or the page) is closed.

### Service-worker to iframe

This is technically possible but adds nothing useful. 

I you have opened an iframe from a page, just use it from there.

The communication is lost when the iframe is closed.

## APIs

### IndexedDB (service-worker, iframe)

This is a simple key-value storage using IndexedDB.

```tsx
const data = ["indexedDB.set", key, value]
```

```tsx
const data = ["indexedDB.get", key]
```

```tsx
const data = ["indexedDB.delete", key]
```

### localStorage (iframe)

This is a simple key-value storage using localStorage.

```tsx
const data = ["localStorage.set", key, value]
```

```tsx
const data = ["localStorage.get", key]
```

```tsx
const data = ["localStorage.delete", key]
```

### WebAuthn KV (service-worker, iframe)

This is a key-value storage using WebAuthn.

This will open a page requiring user confirmation.

```tsx
const data = ["webAuthn.kv.set", key, value]
```

```tsx
const data = ["webAuthn.kv.get", key]
```

```tsx
const data = ["webAuthn.kv.delete", key]
```

## Limitations

The main limitation is storage availability. 

On some browsers the storage is not persistent unless the user adds the storage website to his favorites.

Also, as explained below, an attacker can try to fill the storage with random stuff until it's full.

This can be mitigated by only allowing a limited storage from user-approved origins using a confirmation page.

This can make the UX worse than just using a local storage.

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
