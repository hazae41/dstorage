const webpack = require("webpack")
const fs = require("fs")
const TerserPlugin = require("terser-webpack-plugin")
const Log = require("next/dist/build/output/log")
const path = require("path")
const crypto = require("crypto")

function* walkSync(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(dir, file.name))
    } else {
      yield path.join(dir, file.name)
    }
  }
}

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

    fs.rmSync("./.webpack", { force: true, recursive: true })

    for (const file of walkSync("./public"))
      if (file.endsWith(".h.js"))
        fs.rmSync(file, { force: true })

    promise = Promise.all([
      compileServiceWorkerV1(config, options)
    ])

    return config
  },
  exportPathMap: async (map) => {
    await promise
    return map
  },
  async headers() {
    if (process.env.NODE_ENV !== "production")
      return []
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

  fs.mkdirSync(`./public/${path.dirname(config.output.filename)}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${config.output.filename}`, `./public/${config.output.filename}`)
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

  fs.mkdirSync(`./public/${path.dirname(config.output.filename)}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${config.output.filename}`, `./public/${config.output.filename}`)

  const content = fs.readFileSync(`./.webpack/${config.output.filename}`)
  const hash = crypto.createHash("sha256").update(content).digest("hex")

  fs.copyFileSync(`./.webpack/${config.output.filename}`, `./public/${path.dirname(config.output.filename)}/${hash}.h.js`)
}

/**
 * @param {import("next/dist/server/config-shared").WebpackConfigContext} options
 */
async function compileServiceWorkerV1(config, options) {
  await compileAndHash("v1/service_worker", {
    devtool: false,
    target: "webworker",
    mode: config.mode,
    resolve: config.resolve,
    resolveLoader: config.resolveLoader,
    module: config.module,
    plugins: config.plugins,
    entry: "./src/mods/v1/scripts/service_worker/index.ts",
    output: {
      path: path.join(process.cwd(), ".webpack"),
      filename: "v1/service_worker.js"
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}

module.exports = nextConfig
