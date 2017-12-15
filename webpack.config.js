const path = require('path')

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  module: {
    loaders: [{ test: /\.tsx?$|\.jsx?$/, loader: 'awesome-typescript-loader', exclude: /node_modules/ }]
  }
}
