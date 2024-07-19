const TerserPlugin = require("terser-webpack-plugin")
const path = require("path")
const { NextAsImmutable, withImmutable } = require("@hazae41/next-as-immutable")
const fs = require("fs")

function* walkSync(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(directory, file.name))
    } else {
      yield path.join(directory, file.name)
    }
  }
}

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
      filename: "./v1/service_worker.latest.js"
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}

module.exports = withImmutable({
  reactStrictMode: false,
  swcMinify: true,
  output: "export",
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],

  compiles: function* (wpconfig) {
    for (const absolute of walkSync("./public")) {
      const filename = path.basename(absolute)

      if (filename.startsWith("service_worker."))
        fs.rmSync(absolute, { force: true })

      continue
    }

    yield compileServiceWorkerV1(wpconfig)
  }
})