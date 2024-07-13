import { Layout } from "@/mods/v1/comps/app"

export default function Page() {
  return <Layout>
    <Subpage />
  </Layout>
}

export function Subpage() {
  return <>Please do not close this page</>
}