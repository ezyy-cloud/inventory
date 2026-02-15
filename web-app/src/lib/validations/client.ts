import { z } from 'zod'

const optionalString = z.union([z.string().trim(), z.literal('')]).optional()
const optionalEmail = z
  .union([z.string().trim(), z.literal('')])
  .optional()
  .refine((v) => !v || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Enter a valid email address',
  })

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  industry: optionalString,
  contact_name: optionalString,
  email: optionalEmail,
  phone: optionalString,
  address: optionalString,
  billing_address: optionalString,
  tax_number: optionalString,
  notes: optionalString,
})

export type ClientFormValues = z.infer<typeof clientFormSchema>
