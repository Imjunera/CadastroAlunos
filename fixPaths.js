const fs = require("fs");
const path = require("path");

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");

  const isIndex = filePath.endsWith("index.html");

  const base = isIndex ? "" : "../../";

  content = content
    .replace(/href="[^"]*style\.css[^"]*"/g, `href="${base}css/style.css"`)
    .replace(/src="[^"]*main\.js[^"]*"/g, `src="${base}js/main.js"`)
    .replace(/src="[^"]*script\.js[^"]*"/g, `src="${base}js/main.js"`)
    .replace(/src="[^"]*logo\.png[^"]*"/g, `src="${base}assets/images/logo.png"`)
    .replace(/src="[^"]*illogo\.png[^"]*"/g, `src="${base}assets/images/illogo.png"`);

  fs.writeFileSync(filePath, content);
  console.log("OK:", filePath);
}

function walk(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith(".html")) {
      processFile(fullPath);
    }
  });
}

// roda no projeto inteiro
walk(".");