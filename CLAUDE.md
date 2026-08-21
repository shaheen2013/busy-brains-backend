@AGENTS.md

# Claude rules (busy-brains-backend)

## DTO validation is mandatory

When adding or changing any endpoint input (body, query, params):

- Always use a **class-validator** request DTO with validators on every field.
- Prefer module `dto/` or `dtos/` folders; mirror sibling DTOs (`@ApiProperty`, `@IsOptional`, `@Type`).
- Never accept untyped/`any` request bodies.
- Prefer a small DTO over `@Body("field")` for single fields.
- Never disable or weaken the global `ValidationPipe({ whitelist: true })`.

Full rules: see **DTO validation (mandatory)** in `AGENTS.md`.

## No em dashes

Do not use the em dash (`—`). Prefer `-`, `:`, or a normal sentence break in comments, docs, and generated commit/PR text.

## No emoji

Do not use emoji in code, comments, docs, logs, toasts, UI/i18n, or generated commit/PR text. Prefer plain text.
