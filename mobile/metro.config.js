// The app reads the website's plain maths (dates, units, plan weeks) from ../src/lib through the @shared alias.
// It only reads those files; they change only in a website pull request.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../src/lib")];
module.exports = config;
