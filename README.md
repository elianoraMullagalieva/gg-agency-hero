# GG Agency — hero «Строим продажи под ключ»

Первый экран лендинга: WebGL-арка из квадратных точек, под ней —
тусклая сетка глифов «Sales» с бегущей волной.

## Состав

- `index.html` — разметка первого экрана
- `styles.css` — стили, выверены по макету Figma (1440×810)
- `main.js` — два canvas-слоя: арка (WebGL) и сетка глифов (2D)
- `fonts/HeadingNowVar.woff2` — вариативный шрифт

## Слои

| z-index | Слой | Что это |
|---|---|---|
| 0 | `.hero__glyphs` | сетка букв Sales, 2D canvas |
| 1 | `.hero__bg` | арка Predictive Arc, WebGL, `mix-blend-mode: lighten` |
| 2 | `.nav` / `.hero__body` / `.stats` | интерфейс |

## Настройки арки

Из панели Originkit: фон `#030303`, база `#7D0510`, акцент `#710F11`,
подсветка `#AC0C0F`, density 78, dot 137%, speed 84,
arch 100 · 0 · 206 · falloff 600, pointer 281 · 25.

## Локальный запуск

```bash
python3 -m http.server 8788
```

Открыть http://localhost:8788
