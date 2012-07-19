
var html_at = require('../html/ast_tools');

module.exports = function(flowData){

  var fconsole = flowData.console;
  var queue = flowData.files.queue;

  //
  // Scan html files for styles
  //

  fconsole.start('Scan html files for styles');

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relpath);

      html_at.walk(file.ast, function(node){
        switch (node.type)
        {
          case 'tag':
            var attrs = html_at.getAttrs(node);
            if (node.name == 'link' && /\bstylesheet\b/i.test(attrs.rel))
            {
              fconsole.log('External style found: <link rel="' + attrs.rel + '">');
              flowData.files.add({
                source: 'html:link',
                type: 'style',
                filename: file.resolve(attrs.href),
                media: attrs.media || 'all',
                htmlInsertPoint: node
              });
            }

            break;

          case 'style':
            var attrs = html_at.getAttrs(node);

            // ignore <style> with type other than text/css
            if (attrs.type && attrs.type != 'text/css')
            {
              fconsole.log('[!] <style> with type ' + attrs.type + ' ignored');
              return;
            }

            fconsole.log('Inline style found');

            flowData.files.add({
              source: 'html:style',
              type: 'style',
              baseURI: file.baseURI,
              inline: true,
              media: attrs.media || 'all',
              htmlInsertPoint: node,
              content: html_at.getText(node)
            });

            break;
        }
      });

      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Search for styles files in html
  //

  fconsole.log('Prepare output files');
  var outputFiles = queue.filter(function(file){
    return file.type == 'style' && file.htmlInsertPoint;
  });

  fconsole.log();


  //
  // Search for style in html
  //

  fconsole.start('Process styles');
  for (var i = 0, file; file = flowData.files.queue[i]; i++)
  {
    if (file.type == 'style')
    {
      fconsole.start(file.relpath);
      processFile(file, flowData);
      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Save result in flow
  //

  flowData.css = {
    outputFiles: outputFiles
  };

};

module.exports.handlerName = '[css] Extract';


//
// Main part: file process
//

var csso = require('csso');
var utils = require('../misc/utils');
var at = require('./ast_tools');

function processFile(file, flowData){
  var fconsole = flowData.console;

  // import tokens
  file.imports = [];

  // parse css into tree
  file.ast = csso.parse(file.content, 'stylesheet');

  // search and extract css files
  at.walk(file.ast, {
    'atrules': function(token, parentToken){
      // @import
      if (token[2][1] == 'atkeyword' && token[2][2][1] == 'ident' && token[2][2][2] == 'import')
      {
        var parts = token.slice(3);

        if (parts[0][1] == 's')
          parts.shift();

        var firstArg = parts.shift();
        var uri = utils.resolveUri(
          firstArg[1] == 'uri'
            ? at.unpackUri(firstArg)
            : at.unpackString(firstArg[2])
        );

        // ignore externals
        if (uri.url)
          return;

        // resolve import file
        var importFile = flowData.files.add(
          uri.filename
            ? {
                source: 'css:import',
                filename: file.resolve(uri.filename)
              }
            : {
                source: 'css:import',
                type: 'style',
                baseURI: file.baseURI,
                content: uri.content
              }
        );

        // resolve media
        var media = parts;
        if (media[0] && media[0][1] != 's')
          media.unshift(at.packWhiteSpace(' '));

        // add import
        file.imports.push({
          token: parentToken,
          pos: parentToken.indexOf(token),
          code: at.translate(token),
          file: importFile,
          media: media.filter(at.wsFilter).length ? media : []
        });
      }
    }
  });
}