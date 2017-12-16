const webpack = require('webpack')
const path = require('path')

const plugins = [
  // new webpack.DefinePlugin({
  //   'process.env.NODE_ENV': JSON.stringify('production')
  // }),
  // new webpack.optimize.UglifyJsPlugin({
  //   compress: {
  //     warnings: false,
  //     screw_ie8: true,
  //     conditionals: true,
  //     unused: true,
  //     comparisons: true,
  //     sequences: true,
  //     dead_code: true,
  //     evaluate: true,
  //     if_return: true,
  //     join_vars: true
  //   },
  //   output: {
  //     comments: false
  //   }
  // })
]

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  module: {
    loaders: [
      {
        test: /\.tsx?$|\.jsx?$/,
        loader: 'awesome-typescript-loader',
        exclude: /node_modules/,
        options: { silent: true }
      }
    ]
  },
  plugins
}
