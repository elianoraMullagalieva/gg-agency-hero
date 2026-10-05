#!/bin/bash
# Сборка лёгких файлов для сайта: убирает неиспользуемые стили и сжимает CSS/JS.
# Исходники (styles.css, *.js) правим как раньше, потом запускаем ./build.sh
set -e
cd "$(dirname "$0")"
T=$(mktemp -d)
cat > "$T/p.cjs" <<CFG
module.exports = { content: ["index.html","main.js","orbit.js","leak-crystal.js","path-crystal.js","roles-crystal.js","privacy.html","consent.html","mailing.html"],
  css: ["styles.css"], output: "$T", keyframes: true,
  safelist: { standard: [/^is-/,/^has-/,/^on$/,/^fl$/,/^spot$/,/^grain$/,/^rv/,/^swipe-hint/,/^situation--/,/^footer__/,/^cur/,/^odo/,/^preloader/,/^cookie/,/^totop/,/^lead/,/^modal/,/^case-/,/^ink$/,/^pop$/], greedy: [/is-/] },
  defaultExtractor: c => c.match(/[\w-/:%.]+(?<!:)/g) || [] };
CFG
npx --yes purgecss --config "$T/p.cjs"
npx --yes lightningcss-cli --minify --targets ">= 0.5%" "$T/styles.css" -o styles.min.css
for f in main orbit leak-crystal path-crystal roles-crystal; do npx --yes terser $f.js -c -m -o $f.min.js; done
rm -rf "$T"; echo "готово"
