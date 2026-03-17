const path = require("path");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ESBuildMinifyPlugin } = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WebpackBar = require("webpackbar");
const {
  BitableAppWebpackPlugin,
  opdevMiddleware,
} = require("@lark-opdev/block-bitable-webpack-utils");

const webpack = require("webpack");
const cwd = process.cwd();
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const config = {
  entry: path.resolve(__dirname, "../../frontend/src/main.tsx"),
  devtool: isProduction ? false : "inline-source-map",
  mode: isDevelopment ? "development" : "production",
  stats: "errors-only",
  output: {
    path: path.resolve(__dirname, "../dist"),
    clean: true,
    publicPath: isDevelopment ? "/block/" : "./",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [/node_modules\/@lark-open/],
        use: ["source-map-loader"],
        enforce: "pre",
      },
      {
        oneOf: [
          {
            test: /\.[jt]sx?$/,
            include: [
              path.join(cwd, "src"),
              path.resolve(__dirname, "../../frontend/src"),
              path.resolve(__dirname, "../../shared"),
            ],
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve("esbuild-loader"),
                options: {
                  loader: "tsx",
                  target: "es2015",
                },
              },
            ],
          },
          {
            test: /\.css$/,
            use: [
              isDevelopment ? "style-loader" : MiniCssExtractPlugin.loader,
              "css-loader",
            ],
          },
          {
            test: /\.less$/,
            use: [
              isDevelopment ? "style-loader" : MiniCssExtractPlugin.loader,
              "css-loader",
              "less-loader",
            ],
          },
          {
            test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
            type: "asset/resource",
            generator: {
              filename: "assets/[name][ext][query]",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...(isDevelopment
      ? [new ReactRefreshWebpackPlugin(), new WebpackBar()]
      : [new MiniCssExtractPlugin()]),
    new BitableAppWebpackPlugin({
      // open: true, // 控制是否自动打开多维表格
    }),
    new webpack.DefinePlugin({
      __API_BASE_URL__: JSON.stringify("https://invoice-api.gdsgroup.tech"),
      __FEISHU_MODE__: JSON.stringify("real"),
    }),
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: "./public/index.html",
      publicPath: isDevelopment ? "/block/" : "./",
    }),
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    modules: [
      path.resolve(__dirname, "../node_modules"),
      "node_modules",
      path.resolve(__dirname, "../../frontend/node_modules"),
    ],
  },
  optimization: {
    minimize: isProduction,
    minimizer: [new ESBuildMinifyPlugin({ target: "es2015", css: true })],
    moduleIds: "deterministic",
    runtimeChunk: true,
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          name: "vendor",
          test: /[\\/]node_modules[\\/]/,
          chunks: "all",
        },
      },
    },
  },
  devServer: isProduction
    ? undefined
    : {
        hot: true,
        client: {
          logging: "error",
        },
        setupMiddlewares: (middlewares, devServer) => {
          if (!devServer || !devServer.app) {
            throw new Error("webpack-dev-server is not defined");
          }
          middlewares.push(opdevMiddleware(devServer));
          return middlewares;
        },
      },
  cache: {
    type: "filesystem",
    buildDependencies: {
      config: [__filename],
    },
  },
};
module.exports = config;
