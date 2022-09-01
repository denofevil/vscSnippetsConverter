const fs = require('fs');
const path = require('path');

function printUsageAndExit() {
  console.error("Usage: <input_dir>");
  console.error("input_dir should be a directory with snippets json files");
  process.exit(1)
}

function xmlEscape(string) {
  return string.replace(/([&"<>\n'])/g, (str, item) => {
    const map = {
      '>': '&gt;',
      '<': '&lt;',
      "'": '&apos;',
      '"': '&quot;',
      '&': '&amp;',
      "\n": '&#10;'
    };
    return map[item];
  });
}

function mapContext(string) {
  const map = {
    'html': "HTML",
    'typescript': "TypeScript"
  };
  return map[string] || config.contextMapping[string] || string;
}

function capitalize(string) {
  return string[0].toUpperCase() + string.substr(1)
}

function convertSnippet(snippet, context) {
  let vars = {};
  const templateConfig = config.templates[snippet.prefix] ?? {}

  let body = typeof snippet.body === 'string' ? snippet.body : snippet.body.join("\n");
  body = body.replace(/\\t/, '');
  let replacement = (str, match, name, value) => {
    const shortMatch = typeof value === "number" || value === undefined;
    name = !name.match(/\d*/) || shortMatch || !value.match(/^[_a-zA-Z0-9\-]+$/g) ? name : value;

    const varConfig = templateConfig.variables?.[name]
    name = varConfig?.name ?? name
    value = varConfig?.defaultValue ?? (shortMatch ? undefined : value);

    const original = name;
    name = name === "0" ? "END" : name;
    name = name.replace("-", "_");
    vars[name] = value || (!shortMatch ? original : "");
    return "$" + name + "$";
  };
  body = body.replace(/\$(([_a-zA-Z0-9\-]+))/g, replacement);
  body = body.replace(/\${(([_a-zA-Z0-9\-]+)(?:\s*:\s*\${([^}]+)})?)}/g, replacement);
  body = body.replace(/\${(([_a-zA-Z0-9\-]+)(?:\s*:\s*([^}]+))?)}/g, replacement);

  const description = templateConfig.description ??
    (templateConfig.descriptionPrefix ? templateConfig.descriptionPrefix + " " + snippet.description : capitalize(snippet.description))

  let templateText = `
  <template name="${xmlEscape(snippet.prefix)}"
            value="${xmlEscape(body)}"
            description="${xmlEscape(description)}"
            toReformat="true" toShortenFQNames="true">`;
  for (const variable of Object.keys(vars)) {
    if (variable === "END") continue;

    templateText += `
    <variable name="${variable}" expression="" defaultValue="&quot;${vars[variable]}&quot;" alwaysStopAt="true"/>`;
  }
  if (templateConfig.context) {
    templateText += `
    <context>`
    for (context of templateConfig.context) {
      templateText += `
      <option name="${context}" value="true"/>`;
    }
    templateText += `
    </context>`
  } else {
    templateText += `
    <context>
      <option name="${mapContext(context)}" value="true"/>
    </context>`;
  }

  templateText += "\n  </template>\n";
  return templateText;
}
function convertFile(input, file) {
  console.error(`converting ${file}`);
  const snippets = JSON.parse(fs.readFileSync(`${input}/${file}`));
  let templates = "";
  for (const name of Object.keys(snippets).sort()) {
    const snippet = snippets[name];
    templates += convertSnippet(snippet, file.substr(0, file.indexOf('.')));
  }
  return templates;
}

const input = process.argv[2];
const config = {
  contextMapping: {},
  templates: {},
  ...(process.argv[3] ? require(process.argv[3]) : {})
}

if (!input) {
  printUsageAndExit()
}

fs.readdir(input, (err, files) => {
  let templateSetText = `<?xml version="1.0" encoding="UTF-8"?>\n\n<templateSet group="${config.templateSetName ?? path.basename(path.dirname(input))}">`;
  files.forEach(file => {
    templateSetText += convertFile(input, file)
  });
  templateSetText += "\n</templateSet>";

  console.log(templateSetText);
});
