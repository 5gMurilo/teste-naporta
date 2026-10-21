import { z } from 'zod';

export const loginRequestSchema = z
  .strictObject({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .meta({ description: 'Email address; trimmed and lowercased.', example: 'demo@example.com' }),
    password: z
      .string()
      .min(1)
      .meta({ description: 'Password; never trimmed.', example: 'a-strong-demo-password' }),
  })
  .meta({ id: 'LoginRequest' });

export const loginResponseSchema = z
  .strictObject({
    accessToken: z.string().meta({ description: 'Signed HS256 JWT.' }),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().positive().meta({ description: 'Token lifetime in seconds.' }),
  })
  .meta({
    id: 'LoginResponse',
    example: { accessToken: 'eyJhbGciOiJIUzI1NiJ9...', tokenType: 'Bearer', expiresIn: 3600 },
  });

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
