const webpack = require("webpack")
const { copyFileSync, rmSync, readFileSync } = require("fs")
const TerserPlugin = require("terser-webpack-plugin")
const Log = require("next/dist/build/output/log")
const path = require("path")
const { createHash } = require("crypto")

/**
 * @type {Promise<void> | undefined}
 */
let promise = undefined

/**
 * @type {import("next").NextConfig}
 */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  output: "export",
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  generateBuildId: async () => {
    return "unique"
  },
  webpack(config, options) {
    if (options.isServer)
      return config

    rmSync("./.webpack", { force: true, recursive: true })

    promise = Promise.all([
      compileServiceWorker(config, options)
    ])

    return config
  },
  exportPathMap: async (map) => {
    await promise
    return map
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

/**
 * @param {import("next/dist/server/config-shared").WebpackConfigContext} options
 */
async function compile(name, config, options) {
  Log.wait(`compiling ${name}...`)

  const start = Date.now()

  const status = await new Promise(ok => webpack(config).run((_, status) => ok(status)))

  if (status?.hasErrors()) {
    Log.error(`failed to compile ${name}`)
    Log.error(status.toString({ colors: true }))
    throw new Error(`Compilation failed`)
  }

  Log.ready(`compiled ${name} in ${Date.now() - start} ms`)
  copyFileSync(`./.webpack/${config.output.filename}`, `./public/${config.output.filename}`)
}

/**
 * @param {import("next/dist/server/config-shared").WebpackConfigContext} options
 */
async function compileAndHash(name, config, options) {
  Log.wait(`compiling ${name}...`)

  const start = Date.now()

  const status = await new Promise(ok => webpack(config).run((_, status) => ok(status)))

  if (status?.hasErrors()) {
    Log.error(`failed to compile ${name}`)
    Log.error(status.toString({ colors: true }))
    throw new Error(`Compilation failed`)
  }

  Log.ready(`compiled ${name} in ${Date.now() - start} ms`)
  copyFileSync(`./.webpack/${config.output.filename}`, `./public/${config.output.filename}`)

  const content = readFileSync(`./.webpack/${config.output.filename}`)
  const hash = createHash("sha256").update(content).digest("hex")

  copyFileSync(`./.webpack/${config.output.filename}`, `./public/${hash}.h.js`)
}

/**
 * @param {import("next/dist/server/config-shared").WebpackConfigContext} options
 */
async function compileServiceWorker(config, options) {
  await compileAndHash("service_worker", {
    devtool: false,
    target: "webworker",
    mode: config.mode,
    resolve: config.resolve,
    resolveLoader: config.resolveLoader,
    module: config.module,
    plugins: config.plugins,
    entry: "./src/mods/scripts/service_worker/index.ts",
    output: {
      path: path.join(process.cwd(), ".webpack"),
      filename: "service_worker.js"
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}

module.exports = nextConfig
