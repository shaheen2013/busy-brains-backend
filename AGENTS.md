# AGENTS.md - busy-brains-backend

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this backend repo.

## What this service is

NestJS API with TypeORM, Stripe/Clerk integrations, and Swagger. Request input is validated with
**class-validator** DTOs and a global `ValidationPipe({ whitelist: true })` in `src/main.ts`.

## DTO validation (mandatory)

Every user-input path (body, query, or params that accept client data) must use a validated DTO.

1. Prefer a request DTO under the module `dto/` or `dtos/` folder.
2. Put **class-validator** decorators on every field (`@IsString`, `@IsNotEmpty`, `@IsEnum`,
   `@IsUUID`, `@IsInt`, `@Min`/`@Max`, `@IsOptional`, `@IsIn`, `@IsBoolean`, `@IsObject`,
   `@ValidateIf`, etc.).
3. Use `class-transformer` `@Type(() => Number)` when query/body numbers arrive as strings.
4. Annotate with `@ApiProperty` / `@ApiPropertyOptional` to match sibling DTOs.
5. Keep the global `ValidationPipe` with `whitelist: true` - never disable or weaken it to make a
   request pass.
6. Do not invent Zod, Formik, RHF, or other stacks. Match this repo.

### Required pattern

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdatePaymentMethodDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
```

Optional / enum / transform examples already in the repo: `CreateChildDto`, `GetAccessStatusDto`,
`PayoffWeeklySubscriptionDto`, `UpdateChildDto` (`PartialType`).

### Anti-patterns

- `@Body() body: any` or plain objects without validators
- Pulling a single field with `@Body("otp") otp: string` instead of a DTO (prefer a small DTO
  like `DeleteChildDto`)
- Skipping validators and trusting the client
- Disabling `ValidationPipe` or turning off `whitelist` without an explicit approved reason
- Adding Zod / Yup / Joi / Formik for Nest request validation

## Writing style (mandatory)

- **Do not use em dashes (`—`).** Prefer `-`, `:`, comma, or a full stop in comments, docs, and
  agent-generated commit or PR text. Replace existing `—` when you edit that text.
- **Do not use emoji.** Prefer plain text in code, comments, docs, logs, toasts, UI/i18n copy, and
  agent-generated commit or PR text. Remove existing emoji when you edit that text.

## Doing the work

- Match surrounding module style (naming, double quotes, comment density).
- Implement only what was asked. Do not change app behavior while adding agent rules or drive-by
  refactors.
- Do not commit, push, or open a PR unless explicitly asked.
