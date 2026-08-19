import { plainToInstance } from "class-transformer";
import {
  validateSync,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MinLength,
} from "class-validator";

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsNumber()
  @IsNotEmpty()
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  CLERK_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  CLERK_WEBHOOK_SECRET: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_WEBHOOK_SECRET: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_PUBLISHABLE_KEY: string;

  // Credentials for the /api/docs sign-in page. Required in every environment
  // — the docs must never be readable anonymously, local included.
  @IsString()
  @IsNotEmpty()
  DOCS_USER: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  DOCS_PASSWORD: string;

  @IsString()
  @IsOptional()
  NODE_ENV: string = "development";

  @IsString()
  @IsOptional()
  PORT: string = "3001";
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      errors
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("; "),
    );
  }

  return config;
}
