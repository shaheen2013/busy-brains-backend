import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const ClerkUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    // User data will be attached to request by ClerkGuard
    // For now, returning a placeholder
    return (request as { clerkUser?: unknown }).clerkUser || null;
  },
);
