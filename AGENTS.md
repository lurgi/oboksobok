# Project Rules

- If an element needs project-specific styling, implement it as a component with a CSS Module instead of putting scoped styles directly in an Astro page.
- Astro pages should compose layouts and components, while styled UI/layout units live under `src/components`.
- Keep `src/styles/global.css` limited to font imports, design tokens, and base element defaults. Do not put project-specific layout, header, or page classes there.
- Put shared page-shell styling in a component such as `PageLayout`, and put content width constraints on the content component that owns that width.
