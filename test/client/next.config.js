const TerserPlugin = require("terser-webpack-plugin")
const path = require("path")
const { withImmutable, NextAsImmutable } = require("@hazae41/next-as-immutable")

/**
 * @type {import("next").NextConfig}
 */
const nextConfig = withImmutable({
  reactStrictMode: false,
  swcMinify: true,
  output: "export",
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  compiles: function* (wpconfig) {
    yield compileServiceWorker(wpconfig)
  }
})

async function compileServiceWorker(wpconfig) {
  await NextAsImmutable.compileAndVersionAsMacro({
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

module.exports = nextConfig
