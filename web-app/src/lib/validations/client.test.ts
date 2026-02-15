import { describe, it, expect } from 'vitest'
import { clientFormSchema } from './client'

describe('clientFormSchema', () => {
  it('accepts valid client with name only', () => {
    const result = clientFormSchema.safeParse({
      name: 'Acme Corp',
      industry: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      billing_address: '',
      tax_number: '',
      notes: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = clientFormSchema.safeParse({
      name: '',
      industry: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      billing_address: '',
      tax_number: '',
      notes: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'name')).toBe(true)
    }
  })

  it('rejects invalid email', () => {
    const result = clientFormSchema.safeParse({
      name: 'Acme',
      industry: '',
      contact_name: '',
      email: 'not-an-email',
      phone: '',
      address: '',
      billing_address: '',
      tax_number: '',
      notes: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true)
    }
  })

  it('accepts valid email', () => {
    const result = clientFormSchema.safeParse({
      name: 'Acme',
      industry: '',
      contact_name: '',
      email: 'user@example.com',
      phone: '',
      address: '',
      billing_address: '',
      tax_number: '',
      notes: '',
    })
    expect(result.success).toBe(true)
  })
})
