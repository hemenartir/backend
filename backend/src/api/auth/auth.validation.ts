import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    username: z.string()
    .min(1, {message: 'Kullanıcı adı zorunludur.'})
    .max(128, {message: 'Kullanicı adı en fazla 128 karakter olabilir.'})
    ,
    email: z
      .string()
      .min(1, { message: 'Email zorunludur' })
      .email({ pattern: z.regexes.email }),

    password: z
      .string()
      .min(1, { message: 'Şifre zorunludur' }) // required
      .min(6, { message: 'Şifre en az 6 karakter olmalıdır' }), // length
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, { message: 'Email zorunludur' }).email('Geçersiz email'),
    password: z.string().min(1, { message: 'Şifre zorunludur' }),
  }),
});
