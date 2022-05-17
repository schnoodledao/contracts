const { addBeforeLoader, loaderByName } = require("@craco/craco");

module.exports = {
  webpack: {
    configure: function (webpackConfig) {
      const fragLoader = {
        test: /\.(vert|frag)$/,
        use: ['raw-loader', 'glslify-loader']
      };

      addBeforeLoader(webpackConfig, loaderByName("file-loader"), fragLoader);

      return webpackConfig;
    }
  },
  style: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer')
      ]
    }
  }
}
