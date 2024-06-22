const url = new URL(location.href)
const path = url.searchParams.get("path")

self.importScripts(path)