import { Nullable } from "@hazae41/option"

export class Database {

  constructor(
    readonly database: IDBDatabase
  ) { }

  static async openOrThrow(name: string, version: number): Promise<Database> {
    const database = await new Promise<IDBDatabase>((ok, err) => {
      const request = indexedDB.open(name, version)

      request.onupgradeneeded = (e) => {
        const database = request.result

        if (e.oldVersion === 0 && e.newVersion === 1) {
          database.createObjectStore("keyval")
          return
        }

        err(new Error("Version mismatch"))
      }

      request.onblocked = () => err(new Error("Database is blocked"))
      request.onerror = () => err(request.error)
      request.onsuccess = () => ok(request.result)
    })

    return new Database(database)
  }

  async setOrThrow(key: string, value: string): Promise<void> {
    const transaction = this.database.transaction("keyval", "readwrite")
    const store = transaction.objectStore("keyval")

    await new Promise<void>((ok, err) => {
      const request = store.put(value, key)

      request.onerror = () => err(request.error)
      request.onsuccess = () => ok()
    })

    transaction.commit()
  }

  async getOrThrow(key: string): Promise<Nullable<string>> {
    const transaction = this.database.transaction("keyval", "readonly")
    const store = transaction.objectStore("keyval")

    const value = await new Promise<string>((ok, err) => {
      const request = store.get(key)

      request.onerror = () => err(request.error)
      request.onsuccess = () => ok(request.result)
    })

    transaction.commit()

    return value
  }

}