const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'metro-runtime': path.resolve(__dirname, 'node_modules/metro-runtime'),
};

module.exports = config;
