import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export function Roles(...roles:string[]): MethodDecorator{
    return SetMetadata(ROLES_KEY, roles);
}