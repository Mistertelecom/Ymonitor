import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './strategies/jwt.strategy';

export interface UserFromJwt {
  sub: string;
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: Array<{
    resource: string;
    action: string;
  }>;
}

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserFromJwt => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);