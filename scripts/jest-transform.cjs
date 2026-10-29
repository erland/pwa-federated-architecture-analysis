const ts = require("typescript");
module.exports = {
  process(src, path) {
    return {
      code: ts.transpileModule(src, {
        fileName: path,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
    };
  },
};
