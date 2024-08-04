const TerserPlugin = require("terser-webpack-plugin")
const path = require("path")
const { NextAsImmutable, withNextAsImmutable } = require("@hazae41/next-as-immutable")
const { withNextSidebuild, NextSidebuild } = require("@hazae41/next-sidebuild")

async function compileServiceWorker(wpconfig) {
  await NextSidebuild.compile({
    name: "service_worker",
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
      filename: "./service_worker.latest.js"
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}

module.exports = withNextAsImmutable(withNextSidebuild({
  reactStrictMode: false,
  swcMinify: true,

  sidebuilds: function* (wpconfig) {
    yield compileServiceWorker(wpconfig)
  }
}))
