const TerserPlugin = require("terser-webpack-plugin")
const path = require("path")
const { withNextAsImmutable } = require("@hazae41/next-as-immutable")
const { NextSidebuild, withNextSidebuild } = require("@hazae41/next-sidebuild")

module.exports = withNextAsImmutable(withNextSidebuild({
  reactStrictMode: false,
  swcMinify: true,

  /**
   * Allow service-worker scoping
   */
  trailingSlash: true,

  sidebuilds: function* (wpconfig) {
    yield compileServiceWorkerV0(wpconfig)
  }
}))

async function compileServiceWorkerV0(wpconfig) {
  await NextSidebuild.compile({
    name: "v0/service_worker",
    devtool: false,
    target: "webworker",
    mode: wpconfig.mode,
    resolve: wpconfig.resolve,
    resolveLoader: wpconfig.resolveLoader,
    module: wpconfig.module,
    plugins: wpconfig.plugins,
    entry: "./src/mods/scripts/service_worker/index.ts",
    output: {
      path: path.join(process.cwd(), ".webpack"),
      filename: "./v0/service_worker.latest.js"
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}