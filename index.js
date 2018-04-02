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
  return map[string] || string;
}

function convertSnippet(snippet, context) {
  let vars = {};

  let body = typeof snippet.body === 'string' ? snippet.body : snippet.body.join("\n");
  body = body.replace(/\\t/, '');
  let replacement = (str, match, name, value) => {
    const shortMatch = typeof value === "number" || value === undefined;
    name = !name.match(/\d*/) || shortMatch ? name : value;
    value = shortMatch ? undefined : value;
    const original = name;
    name = name === "0" ? "END" : name;
    name = name.replace("-", "_");
    vars[name] = value || (!shortMatch ? original : "");
    return "$" + name + "$";
  };
  body = body.replace(/\$(([_a-zA-Z0-9\-]+))/g, replacement);
  body = body.replace(/\${(([_a-zA-Z0-9\-]+)(?:\s*:\s*([_a-zA-Z0-9\-]+))?)}/g, replacement);

  let templateText = `
  <template name="${xmlEscape(snippet.prefix)}" value="${xmlEscape(body)}" description="${xmlEscape(snippet.description)}" toReformat="true" toShortenFQNames="true">`;
  for (const variable of Object.keys(vars)) {
    if (variable === "END") continue;

    templateText += `
    <variable name="${variable}" expression="" defaultValue="&quot;${vars[variable]}&quot;" alwaysStopAt="true" />`;
  }
  templateText += `
    <context>
      <option name="${mapContext(context)}" value="true" />
    </context>
  </template>`;

  templateText += "";
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

if (!input) {
  printUsageAndExit()
}

fs.readdir(input, (err, files) => {
  let templateSetText = `<templateSet group="${path.basename(path.dirname(input))}">`;
  files.forEach(file => {
    templateSetText += convertFile(input, file)
  });
  templateSetText += "\n</templateSet>";

  console.log(templateSetText);
});
