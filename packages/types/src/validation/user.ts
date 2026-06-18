import { z } from 'zod'
import { validEmail, indianPhone, strongPassword } from './common'
import { Role } from '../enums'

export const CreateUserSchema = z.object({
  name:     z.string().trim().min(2, 'Name must be at least 2 characters'),
  email:    validEmail,
  phone:    indianPhone.optional(),
  role:     z.nativeEnum(Role),
  branchId: z.string().min(1, { message: 'Branch is required' }),
  sendSetupLink: z.boolean().default(true),
})

export const UpdateUserSchema = z.object({
  name:     z.string().trim().min(2).optional(),
  phone:    indianPhone.optional(),
  branchId: z.string().min(1).optional(),
  role:     z.nativeEnum(Role).optional(),
})

export const AdminResetPasswordSchema = z.object({
  newPassword: strongPassword,
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type AdminResetPasswordInput = z.infer<typeof AdminResetPasswordSchema>