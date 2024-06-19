export default function Page() {
  const { version, update } = window as any

  return <div className="flex flex-col items-center">
    {version &&
      <div>
        Version: {version}
      </div>}
    {update &&
      <button onClick={() => { update(); location.reload() }}>
        Update
      </button>}
    {!update &&
      <div>
        No update available
      </div>}
    <button onClick={() => location.reload()}>
      Refresh
    </button>
  </div>
}