var js_at = require('../../ast').js;
var path = require('path');

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var templateModule = flow.tmpl.module;

  /*console.log(flow.js.globalScope.resolve(['dot', ['dot', ['name', 'basis'], 'template'], 'define']));
  console.log(flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'template']))
  process.exit();*/

  //
  // process tmpl resources
  //

  var implicitDefineSeed = 1;
  var implicitMap = {};
  var implicitDefine = {
    base: {}
  };

  // Temporary solution
  // TODO: rework it
  (function(){
    for (var key in flow.files.preprocess)
      flow.files.preprocess[key].forEach(function(preprocessor){
        if (typeof preprocessor.init == 'function')
          preprocessor.init(flow, basis);
      });
  })();

  fconsole.start('Check templates and implicit define');
  flow.js.resources.forEach(function(token){
    var file = token.resourceRef;
    if (file.type == 'template')
    {
      var code = js_at.translate(token);
      if (!token.themeDefined)
      {
        var templateGet = js_at.parse('basis.template.get', 1);
        var id;

        if (!implicitMap[file.relpath])
        {
          id = '#' + (implicitDefineSeed++).toString(36);
          implicitMap[file.relpath] = id;
          var resToken = token.slice();
          resToken.ref_ = token.ref_;
          resToken.refPath_ = token.refPath_;
          resToken.resourceRef = token.resourceRef;
          flow.tmpl.themeResources.base[id] = resToken;
          implicitDefine.base[id] = token.resourceRef;
        }
        else
        {
          id = implicitMap[file.relpath];
        }

        token.ref_ = flow.js.globalScope.resolve(templateGet);
        token.refPath_ = 'basis.template.get';
        token[1] = templateGet;
        token[2] = [['string', id]];
        //console.log(token);
        //token.splice(0, token.length, ['call', templateGet, [['string', 'xx']]]);
        fconsole.log(code, '->', js_at.translate(token));
      }
      else
      {
        fconsole.log(code, 'already in theme define');
      }
    }
  });
  fconsole.endl();

  //addImplicitDefine(flow, 'base', implicitBase);

  //
  // process themes
  //

  // collect keys
  var defineKeys = {};
  var themeList = [];
  for (var themeName in flow.tmpl.themes)
  {
    themeList.push(themeName);
    var themeResources = flow.tmpl.themeResources[themeName];
    for (var key in themeResources)
      defineKeys[key] = true;
  }

  fconsole.start('Apply template defines');
  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');

    var themeResources = flow.tmpl.themeResources[themeName];
    for (var key in themeResources)
    {
      var resource = themeResources[key];
      if (resource.resourceRef)
      {
        fconsole.log(key, '->', 'basis.resource(\'' + resource.resourceRef.filename + '\')');
        // replace here because on windows it starts with `C:` or like so,
        // basis.js 1.2+ warn on it
        flow.js.basis.template.theme(themeName)
          .define(key, flow.js.basis.resource(resource.resourceRef.filename.replace(/^.*?([\/\\])/, '$1')));
      }
      else
      {
        flow.warn({
          message: 'template source is not a basis.js resource: path `' + key + '` in theme `' + themeName + '`'
        });
      }
    }
    fconsole.endl();
  }
  fconsole.endl();

  //
  // process templates
  //

  function copyWarnsToFlow(warns){
    if (warns)
      warns.forEach(function(warn){
        var filename = file && file.relpath;

        if (warn.loc)
        {
          var locFilename = warn.loc.replace(/\:\d+\:\d+$/, '');
          if (locFilename != filename)
          {
            filename = locFilename;

            // filter duplicated
            if (!knownNestedWarnings[filename])
              knownNestedWarnings[filename] = {};
            if (knownNestedWarnings[filename][warn + warn.loc])
              return;
            knownNestedWarnings[filename][warn + warn.loc] = true;
          }
        }

        flow.warn({
          file: filename,
          theme: themeName,
          message: String(warn),
          loc: warn.loc
        });
      });
  }


  fconsole.start('Make template declarations');
  var baseDecl = {};
  var knownResources = {};
  var knownNestedWarnings = {};

  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');
    flow.js.basis.template.setTheme(themeName);

    if (!implicitDefine[themeName])
      implicitDefine[themeName] = {};

    var themeProcessedResources = [];
    for (var key in defineKeys)
    {
      var source = flow.js.basis.template.get(key);

      // prevent double resource processing as it can produce the same result but with various isolation
      if (typeof source.value == 'object' && !themeProcessedResources.add(source.value))
        continue;

      var resource = flow.tmpl.themeResources[themeName][key];
      var file = resource && resource.resourceRef;
      var decl = flow.js.basis.template.makeDeclaration(source.get(), path.dirname(source.url) + '/', {
        optimizeSize: flow.options.jsCutDev,
        loc: true
      }, source.url, source);
      var hash = [source.get()]
        .concat(decl.deps.map(function(dep){
          return dep.url || dep;
        }))
        .join('\x00');

      fconsole.start(key + (file ? ': basis.resource("' + file.relpath + '")' : ''));

      if (themeName == 'base')
      {
        // save all base templates in map
        baseDecl[key] = {
          hash: hash,
          decl: decl
        };

        if (file)
          file.themes = [themeName];

        // copy warnings to flow
        copyWarnsToFlow(decl.warns);
      }
      else
      {
        if (resource)
        {
          if (file)
            file.themes = (file.themes || []).concat(themeName);

          // copy warnings to flow
          copyWarnsToFlow(decl.warns);
        }
        else
        {
          // theme has no it's own template source for that path
          // but template may contains inclusion, that can changes theme by themes
          if (hash != baseDecl[key].hash)
          {
            // template result has difference with base template -> some inclusion depends on theme
            // create fake file for result, and mark it to store in resource map
            var genericFilename = 'genericTemplate' + (implicitDefineSeed++) + '.tmpl';
            file = flow.files.add({
              jsRefCount: 1,
              generatedFrom: source.url || false,
              generated: true,
              themes: [themeName],
              type: 'template',
              isResource: true
            });

            // set filename aside, to prevent file manager to read file with that name
            // filename requires for jsRef generation, and actualy it's a hack
            // TODO: solve the problem
            file.filename = genericFilename;
            file.filename = file.jsRef && null; // generate jsRef

            // add to implicit map
            implicitDefine[themeName][key] = file;

            fconsole.log('[i] add implicit define', genericFilename);
          }
          else
          {
            if (file)
              file.themes = (file.themes || []).concat(themeName);

            // declaration the same, just mask all template resource as required in current theme too
            var resources = baseDecl[key].decl.resources;
            if (resources.length)
            {
              for (var j = 0, resourceFilename; resourceFilename = resources[j]; j++)
              {
                var resFile = flow.js.basis.resource(resourceFilename).buildFile;
                if (resFile && resFile.themes)
                  resFile.themes.add(themeName);
              }
            }
          }
        }
      }

      if (file)
      {
        // if file exists, store declaration and link it with resources
        file.decl = decl;
        file.ast = decl.tokens;

        if (decl.resources.length)
        {
          for (var j = 0, resourceFilename; resourceFilename = decl.resources[j]; j++)
          {
            var resource = flow.js.basis.resource(resourceFilename);
            var resourceUrl = resource().url.replace(/\?.*$/, '');
            var resFile = knownResources[resourceFilename] || flow.files.add(
              resource.virtual  // treat virtual resources as inline
                ? {
                    type: 'style',  // are there possible other kind of resources?
                    inline: true,
                    generatedFrom: resource().url,
                    generated: true,
                    baseURI: resource().baseURI,
                    content: resource().cssText,
                    themes: []
                  }
                : {
                    filename: resourceFilename, // resource filename already resolved, and should be absolute
                    themes: []
                  }
            );

            // to prevent duplicates
            knownResources[resourceFilename] = resFile;

            // set filename for virtual resources to add them to file-graph
            if (resource.virtual)
              resFile.filename = resource().url.replace(/\?.*$/, '');

            resource.buildFile = resFile;

            // if file has no themes property, that means css file used by other sources
            if (resFile.themes)
              resFile.themes.add(themeName);
            else
              resFile.noThemes = true;

            file.link(resFile, decl.resources);
            resFile.isResource = true;
          }
        }
      }
      fconsole.endl();
    }
    fconsole.endl();
  }
  fconsole.endl();

  // inject implicit
  for (var themeName in flow.tmpl.themes)
    addImplicitDefine(flow, themeName, implicitDefine[themeName]);
}).handlerName = '[tmpl] Extract';

module.exports.skip = function(flow){
  if (!flow.tmpl.module)
    return 'basis.template is not found';
};


//
// utils
//

function addImplicitDefine(flow, themeName, map){
  var object = ['object', []];
  var files = [];

  for (var key in map)
  {
    var file = map[key];
    var token = ['call', ['dot', ['name', 'basis'], 'resource'], [['string', file.jsRef]]];

    token.ref_ = flow.js.globalScope.resolve(token[1]);
    token.refPath_ = 'basis.resource';
    token.resourceRef = file;

    object[1].push([key, token]);
    files.push(file);
  }

  if (object[1].length)
  {
    var injectCode = js_at.parse('getTheme().define()')[1];

    injectCode[0][1][1][1][2] = [['string', themeName]];
    injectCode[0][1][2][0] = object;

    js_at.append(flow.tmpl.module.ast, ['stat', injectCode]);

    Array.prototype.push.apply(flow.tmpl.module.resources, files);
  }
}
