(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = flow.css.idMap;
  var classMap = flow.css.classMap;
  var totalSaving = 0;


  //
  // class rename
  //

  fconsole.start('Process class names');

  var classRenameSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0,
    'tmpl-overhead': 0
  };

  Object.keys(classMap).filter(function(key){
    return !classMap[key].postfix;
  }).sort(function(a, b){
    return (b.length - 1) * classMap[b].length - (a.length - 1) * classMap[a].length;
  }).forEach(function processKey(name, idx){
    function replaceFn(cls){
      var result = cls == name ? replace : cls;
      var saving = cls.length - result.length;
      tokenSaving += saving;
      if (item.type == 'tmpl-enum')
        typeSaving['tmpl-overhead'] += saving;
      return result;
    }
    function replaceStr(str){
      return str.trim().split(/\s+/).map(replaceFn).join(' ');
    }
    function toBase52(num){
      var res = '';
      do {
        var n = num % 52;
        res = String.fromCharCode((n % 26) + (n < 26 ? 97 : 65)) + res;
        num = parseInt(num / 52);
      } while (num);
      return res;
    }

    var list = classMap[name];
    var replace = toBase52(idx) + list.postfix;
    var saving = 0;

    for (var i = 0, item, token; item = list[i]; i++)
    {
      token = item.token;
      tokenSaving = 0;

      switch (item.type){
        case 'html-class':
          token.class = replaceStr(token.class);
          break;
        case 'style-class':
          token[2] = replace;
          tokenSaving = name.length - replace.length;
          break;
        case 'tmpl-class':
          token.context.tokenValue(token, replaceStr(token.context.tokenValue(token)));
          break;
        case 'tmpl-bool':
          tokenSaving += token[0].length - replace.length + 1 + 2; // 1 for comma, 2 for quotes
          token[0] = '';
          token.push(replace);
          break;
        case 'tmpl-enum':
          if (!token[4])
          {
            token[4] = token[3].map(function(cls){
              return token[0] + cls;
            });
            typeSaving['tmpl-overhead'] += token[0].length - JSON.stringify(token[4]).length - 1; // 1 for comma
            token[0] = '';
          }

          token[4] = token[4].map(replaceFn);
          break;
        case 'tmpl-boolAnim':
        case 'tmpl-enumAnim':
          // nothing todo
          break;
        default:
          flow.warn({
            fatal: true,
            message: 'Unknown token type - ' + cfg.type
          });
      }

      saving += tokenSaving;
      typeSaving[item.type.split('-')[0]] += tokenSaving;
    }

    classRenameSaving += saving;
    totalSaving += saving;
    fconsole.log(name, '->', replace, '(' + saving + ' / ' + list.length + ')');

    list.nested.forEach(function(nestedName){
      processKey(nestedName, idx);
    });
  });
  fconsole.endl();

  classRenameSaving += typeSaving['tmpl-overhead'];
  fconsole.start('Total class rename saving:', classRenameSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + typeSaving[type] + ' bytes';
  }));
  fconsole.endl();


  //
  // id
  //

  fconsole.start('Process id');

  var idRenameSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0
  };

  Object.keys(idMap).sort(function(a, b){
    return (b.length - 1) * idMap[b].length - (a.length - 1) * idMap[a].length;
  }).forEach(function(name, idx){
    var list = idMap[name];
    var replace = toBase52(idx);
    var oneSaving = name.length - replace.length;
    var saving = oneSaving * list.length;

    idRenameSaving += saving;
    totalSaving += saving;
    fconsole.log(name, '->', replace, '(' + saving + ')');

    for (var i = 0, item; item = list[i]; i++)
    {
      var token = item.token;
      typeSaving[item.type.split('-')[0]] += oneSaving;
      switch (item.type){
        case 'html-id':
          token.id = replace;
          break;
        case 'style-id':
          token[2] = replace;
          break;
        case 'tmpl-id':
          token.context.tokenValue(token, replace);
          break;
        default:
          flow.warn({
            fatal: true,
            message: 'Unknown token type - ' + cfg.type
          });
      }
    }
  });
  fconsole.endl();

  fconsole.start('Total id rename saving:', idRenameSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + typeSaving[type] + ' bytes';
  }));
  fconsole.endl();

  fconsole.start('Total rename saving:', idRenameSaving + ' bytes');

}).handlerName = '[css] Optimize names';

module.exports.skip = function(flow){
  if (!flow.options.cssOptimizeNames)
    return 'Use option --css-optimize-names';
};

//
// utils
//

function toBase52(num){
  var res = '';
  do {
    var n = num % 52;
    res = String.fromCharCode((n % 26) + (n < 26 ? 97 : 65)) + res;
    num = parseInt(num / 52);
  } while (num);
  return res;
}
