const TerserPlugin = require("terser-webpack-plugin")
const path = require("path")
const { NextAsImmutable, withImmutable } = require("@hazae41/next-as-immutable")

/**
 * @type {import("next").NextConfig}
 */
const nextConfig = withImmutable({
  reactStrictMode: false,
  swcMinify: true,
  output: "export",
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  compiles: function* (wpconfig) {
    yield compileServiceWorkerV1(wpconfig)
  }
})

async function compileServiceWorkerV1(wpconfig) {
  await NextAsImmutable.compileAndVersionAsMacro({
    name: "v1/service_worker",
    devtool: false,
    target: "webworker",
    mode: wpconfig.mode,
    resolve: wpconfig.resolve,
    resolveLoader: wpconfig.resolveLoader,
    module: wpconfig.module,
    plugins: wpconfig.plugins,
    entry: "./src/mods/v1/scripts/service_worker/index.ts",
    output: {
      path: path.join(process.cwd(), ".webpack"),
      filename: "./v1/service_worker.js"
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}

module.exports = nextConfig
