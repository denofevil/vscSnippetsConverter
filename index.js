const fs = require('fs');

function printUsageAndExit() {
  console.error("Usage: <input_snippet> <output_directory>");
  console.error("input_snippet can be either a file or a directory");
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

  let body = snippet.body.join("\n");
  body = body.replace(/\\t/, '');
  let replacement = (str, name, value) => {
    name = name === "0" ? "END" : name;
    name = name.replace("-", "_");
    vars[name] = value;
    return "$" + name + "$";
  };
  body = body.replace(/\$([_a-zA-Z0-9\-]+)/g, replacement);
  body = body.replace(/\${([_a-zA-Z0-9\-]+(?:\s*:\s*([_a-zA-Z][_a-zA-Z0-9]*))?)}/g, replacement);

  let templateText = `
  <template name="${xmlEscape(snippet.prefix)}" value="${xmlEscape(body)}" description="${xmlEscape(snippet.description)}" toReformat="true" toShortenFQNames="true">`;
  for (const variable of Object.keys(vars).sort()) {
    if (variable === "END") continue;

    templateText += `
    <variable name="${variable}" expression="" defaultValue="&quot;${vars[variable] || variable}&quot;" alwaysStopAt="true" />`;
  }
  templateText += `
    <context>
      <option name="${mapContext(context)}" value="true" />
    </context>
  </template>`;

  templateText += "";
  return templateText;
}
function convertFile(input, file, output) {
  console.log(`converting ${file}`);
  const snippets = JSON.parse(fs.readFileSync(`${input}/${file}`));
  let templateSetText = `<templateSet group="${input}">`;
  for (const name of Object.keys(snippets).sort()) {
    const snippet = snippets[name];
    templateSetText += convertSnippet(snippet, file.substr(0, file.indexOf('.')));
  }

  templateSetText += "\n</templateSet>";
  console.log(templateSetText);
}

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  printUsageAndExit()
}

fs.readdir(input, (err, files) => {
  files.forEach(file => {
    convertFile(input, file, output)
  });
});
