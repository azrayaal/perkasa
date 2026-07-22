import { authAccounts } from '@/data/mockData'
import { respond } from '@/services/http'
import type { AuthUser, LoginPayload } from '@/types'

/** Kredensial yang salah menghasilkan error domain ini, bukan string bebas. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email atau kata sandi tidak sesuai.')
    this.name = 'InvalidCredentialsError'
  }
}

function toPublicUser(account: (typeof authAccounts)[number]): AuthUser {
  // Password tidak pernah ikut keluar dari service layer.
  const { password: _password, ...user } = account
  return user
}

/** TODO: replace with real API call — POST /auth/login */
export async function login({ email, password }: LoginPayload): Promise<AuthUser> {
  const account = authAccounts.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password,
  )

  if (!account) throw new InvalidCredentialsError()

  return respond(toPublicUser(account))
}

/** TODO: replace with real API call — POST /auth/logout */
export function logout(): Promise<void> {
  return respond(undefined)
}

/**
 * Daftar akun demo untuk tombol isi-cepat di halaman login.
 * HAPUS bersama halaman demo saat masuk produksi.
 */
export function getDemoAccounts(): Array<{ email: string; password: string; user: AuthUser }> {
  return authAccounts.map((account) => ({
    email: account.email,
    password: account.password,
    user: toPublicUser(account),
  }))
}
