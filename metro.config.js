const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  server: {
    enhanceMiddleware: (middleware) => {
      return middleware;
    },
  },
  resolver: {
    // package.json's own "react-native" field only redirects require('net')
    // for code inside THIS package — it doesn't reach into llrpjs's own
    // require('net') calls (confirmed live: Metro still failed to resolve
    // "net" from node_modules/llrpjs/dist/src/net/client.js with only that
    // field set). extraNodeModules applies resolver-wide instead, so any
    // require('net') anywhere in the dependency graph — ours or a
    // dependency's — resolves to react-native-tcp-socket's net-workalike.
    // See src/native/impinjRfid.ts for what this makes possible: llrpjs
    // talking LLRP straight to the Impinj reader over a real TCP socket.
    extraNodeModules: {
      net: require.resolve('react-native-tcp-socket'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
