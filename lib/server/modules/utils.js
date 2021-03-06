var path = require('path');
var chalk = require('chalk');
var toolsPath = path.resolve(__dirname + '/../../..');

function ralign(str, len){
  while (str.length < len)
    str = ' ' + str;
  return str;
}

function logMsg(topic, message, verbose){
  if (!verbose || module.exports.verbose)
    console.log(chalk.cyan(ralign(topic.toLowerCase(), 8)) + '  ' + chalk.white(message));
}

function logWarn(topic, message){
  console.log(chalk.red(ralign(topic.toLowerCase(), 8)) + '  ' + chalk.white(message));
}

function relPathBuilder(base){
  var cache = {};
  return function(filename){
    if (cache[filename])
      return cache[filename];

    var resolvedFilename = path.resolve(base, filename);
    var toolsRelativePath = path.relative(toolsPath, resolvedFilename);

    if (toolsRelativePath.charAt(0) != '.' && toolsRelativePath.indexOf(':') == -1)
      return cache[filename] = 'basisjs-tools:/' + toolsRelativePath.replace(/\\/g, '/');

    return cache[filename] = path.relative(base, filename)
      .replace(/\\/g, '/')
      .replace(/^([^\.])/, '/$1');
  };
}

module.exports = {
  verbose: true,
  logMsg: logMsg,
  logWarn: logWarn,
  relPathBuilder: relPathBuilder
};
