module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;


  flowData.dictList = {};
  flowData.l10nKeys = [];

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      process(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
};

module.exports.handlerName = 'Extract dictionary creation calls';

var path = require('path');

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');

function process(file, flowData){
  var context = {
    __filename: file.filename || '',
    __dirname: file.filename ? path.dirname(file.filename) + '/' : ''
  };
  var dictList = {};
  var l10nKeys = [];

  at.walk(file.ast, {
    call: function(expr, args){
      if (at.translate(expr) == CREATE_DICTIONARY)
      {
        var eargs = at.getCallArgs(args, context);
        keys = Object.keys(eargs[2]);

        dictList[eargs[0]] = {
          path: eargs[1],
          keys: keys
        };

        keys.forEach(function(key){
          l10nKeys.push(eargs[0] + '.' + key);
        });  
      }
    }
  });
  
  flowData.l10nKeys.push.apply(flowData.l10nKeys, l10nKeys);
  for (var i in dictList)
    flowData.dictList[i] = dictList[i];
}