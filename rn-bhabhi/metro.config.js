// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '~/components': './src/components',
  '~/services': './src/services',
  '~/engine': './src/engine',
  '~/store': './src/store',
};

module.exports = config;
