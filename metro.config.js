const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .tflite and .wasm to the list of recognized asset extensions
config.resolver.assetExts.push('tflite');
config.resolver.assetExts.push('wasm');

module.exports = config;
