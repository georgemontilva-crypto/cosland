const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// El catálogo (categorías, colores, textos) se comparte con la web desde ../shared
config.watchFolders = [path.resolve(__dirname, "../shared")];

module.exports = config;
