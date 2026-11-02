# Contributing to CarpenTech

## Static-only architecture

This website consists of `index.html` and the CSS, browser JavaScript, images,
SVGs, and fonts in `public/`. Serve these files directly with any static host.
Keep the site static-only: no backend, API routes, server-side rendering,
database, or required production Node.js process. npm dependencies and local
servers exist only for development and testing. Preserve useful content and
navigation when JavaScript is disabled.

## Karpathy coding guidelines

These principles apply to human contributors and AI agents. They are included
here so they remain available without installing a local skill.

1. **Think before coding.** State assumptions, surface uncertainty and tradeoffs,
   and clarify ambiguous requirements. Explain when a simpler approach suffices.
2. **Simplicity first.** Write the minimum code needed. Avoid speculative
   features, premature abstractions, and unrequested configurability.
3. **Surgical changes.** Touch only what the task requires, follow existing
   style, and preserve unrelated work. Remove unused code created by your own
   changes; mention unrelated dead code instead of deleting it incidentally.
4. **Goal-driven execution.** Define observable success criteria. Reproduce bugs
   with a failing test, implement the fix, and verify the result. Break larger
   tasks into small steps with a check for each step.

## Development and verification

Use Node.js 24.8 or newer and Python 3 for the local static preview server:

```sh
npm install --no-save --package-lock=false --ignore-scripts css-tree@3.2.1 html-validate@11.18.0 parse5@8.1.0 fast-xml-parser@5.11.2 postcss@8.5.32
node --test test/*.test.mjs
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173` for a preview. No build step is required.

`node --test test/*.test.mjs` checks page landmarks, unique IDs, local links/assets, and accessibility
references, runs the Node content tests, and recursively checks syntax in project
HTML, CSS, JavaScript (`.js`, `.mjs`, `.cjs`), JSON (including `.webmanifest`),
and SVG files. It includes tests, configuration files, hidden project directories,
and inline HTML scripts, styles, and style attributes. Dependencies, Git metadata,
local agent/tool directories, and generated reports/output are excluded. Images,
fonts, Markdown, and plain text have no programming-language syntax to check;
these checks do not validate their contents or replace visual review.

Keep the repository free of npm manifests, lockfiles, and Playwright configuration.
The command above installs check tools into ignored `node_modules/` without
creating a manifest or lockfile. The website itself requires none of these tools.

For interaction, layout, accessibility, or motion changes, verify the site in a
browser. Existing `test/*.spec.mjs` files are optional Playwright browser specs;
they require a separately supplied harness with a base URL of
`http://127.0.0.1:4173`, a running preview server, Chromium, `@playwright/test`,
and `@axe-core/playwright`. They are separate from the short CI checks.
Do not skip tests or relax validation to hide failures. Report what you ran and
any remaining limitations.

## Continuous integration

GitHub Actions installs the standalone check tools and runs
`node --test test/*.test.mjs` on every push and pull request,
including documentation changes. The syntax, structure, and content checks require
no browser installation, build step, or running server. The job has a five-minute
timeout and can also be started manually from the Actions tab.

## Commit messages

Use this format for every commit:

```text
type(scope): describe the change shortly
```

Use a short, imperative description and a scope naming the affected area.
Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `style`, and `chore`.

```text
test(syntax): validate all static source files
docs(contributing): document the static-only architecture
fix(navigation): restore focus when the menu closes
```
