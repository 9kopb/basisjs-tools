
var atCss = require('../css/ast_tools');
var utils = require('../misc/utils');

module.exports = function(flow){
  var files = flow.files;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  var urlMap = [];

  for (var i = 0, file; file = queue[i]; i++)
  {
    switch (file.type)
    {
      case 'style':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atCss.walk(file.ast, {
          'uri': function(token){
            fconsole.log('Found ' + atCss.translate(token));

            var uri = utils.resolveUri(atCss.unpackUri(token));

            if (uri.filename)
            {
              var resFile = files.add({
                filename: file.resolve(uri.filename)
              });
              file.link(resFile);
              resFile.cssResource = true;
              resFile.outputFilename = flow.outputResourceDir + resFile.digest + resFile.ext;
              resFile.fileRef = resFile.relOutputFilename;

              atCss.packUri(resFile.fileRef, token);
            }
            /*urlMap.push({
              file: file,
              token: token
            });*/
          }
        });

        fconsole.endl();
      break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          var tmpl_at = require('../tmpl/ast_tools');
          tmpl_at.walk(file.ast, {
            attr: function(token, parentToken){
              switch (tmpl_at.tokenName(token))
              {
                case 'src':
                  if (tmpl_at.tokenName(parentToken) == 'img')
                    fconsole.log('Found <img src="' + tmpl_at.tokenValue(token) + '"/>');
                  break;
              }
            }
          });
        }

        fconsole.endl();
      break;
    }
  }
}

module.exports.handlerName = '[res] Extract';