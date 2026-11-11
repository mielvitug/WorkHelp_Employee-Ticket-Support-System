import { demoAccounts } from './demoCredentials.js'
import { employeeUser, supportUser } from './mockData.js'

const accountsKey = 'workhelp:local-accounts'
const sessionKey = 'workhelp:local-session'
const passwordIterations = 120_000
const minPasswordLength = 12
const maxPasswordLength = 35

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored === null ? fallback : JSON.parse(stored)
  } catch {
    throw new Error('Unable to read WorkHelp data from this browser. Check browser storage settings and try again.')
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Unable to save WorkHelp data in this browser. Check available storage and privacy settings.')
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value) {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
}

async function hashPassword(password, salt) {
  const saltBytes = salt ? hexToBytes(salt) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: saltBytes,
    iterations: passwordIterations,
    hash: 'SHA-256',
  }, key, 256)
  return { salt: bytesToHex(saltBytes), hash: bytesToHex(new Uint8Array(bits)) }
}

function publicAccount(account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  }
}

async function seedAccount(user, credentials) {
  const { salt, hash } = await hashPassword(credentials.password)
  return {
    ...user,
    email: credentials.email,
    passwordSalt: salt,
    passwordHash: hash,
  }
}

async function ensureAccounts() {
  let accounts = readJson(accountsKey, null)
  const isNewStorage = accounts === null
  if (accounts !== null && !Array.isArray(accounts)) {
    throw new Error('Saved WorkHelp accounts are invalid. Clear this site’s browser data to start over.')
  }
  if (accounts === null) accounts = []

  const seededAccounts = [
    { user: employeeUser, credentials: demoAccounts.employee },
    { user: supportUser, credentials: demoAccounts.support },
  ]
  let changed = false
  for (const { user, credentials } of seededAccounts) {
    if (!accounts.some((account) => account.id === user.id || account.email === credentials.email)) {
      accounts.push(await seedAccount(user, credentials))
      changed = true
    }
  }
  if (changed || isNewStorage) writeJson(accountsKey, accounts)
  return accounts
}

export async function getCurrentUser() {
  const accounts = await ensureAccounts()
  let userId
  try {
    userId = window.localStorage.getItem(sessionKey)
  } catch {
    throw new Error('Unable to read your WorkHelp session from this browser.')
  }
  const account = accounts.find(({ id }) => id === userId)
  return account ? publicAccount(account) : null
}

export async function signIn(email, password) {
  const accounts = await ensureAccounts()
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const account = accounts.find(({ email: accountEmail }) => accountEmail === normalizedEmail)
  if (!account || typeof password !== 'string') {
    throw new Error('Email or password is incorrect.')
  }
  const { hash } = await hashPassword(password, account.passwordSalt)
  if (hash !== account.passwordHash) {
    throw new Error('Email or password is incorrect.')
  }

  try {
    window.localStorage.setItem(sessionKey, account.id)
  } catch {
    throw new Error('Unable to save your WorkHelp session in this browser.')
  }
  return publicAccount(account)
}

export async function registerEmployee({ name, email, password }) {
  const accounts = await ensureAccounts()
  const normalizedName = typeof name === 'string' ? name.trim() : ''
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (
    !normalizedName ||
    normalizedName.length > 80 ||
    normalizedName.includes('\0') ||
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof password !== 'string' ||
    password.length < minPasswordLength ||
    password.length > maxPasswordLength
  ) {
    throw new Error(`Enter a name, valid email address, and password between ${minPasswordLength} and ${maxPasswordLength} characters.`)
  }
  if (accounts.some(({ email: accountEmail }) => accountEmail === normalizedEmail)) {
    throw new Error('An account with this email already exists in this browser.')
  }

  const id = `u-${crypto.randomUUID()}`
  const { salt, hash } = await hashPassword(password)
  const account = {
    id,
    name: normalizedName,
    email: normalizedEmail,
    role: 'employee',
    passwordSalt: salt,
    passwordHash: hash,
  }
  writeJson(accountsKey, [...accounts, account])
  try {
    window.localStorage.setItem(sessionKey, account.id)
  } catch {
    throw new Error('Account created, but unable to save your WorkHelp session in this browser. Sign in to continue.')
  }
  return publicAccount(account)
}

export async function changePassword(currentPassword, newPassword) {
  const accounts = await ensureAccounts()
  const currentUser = await getCurrentUser()
  const account = accounts.find(({ id }) => id === currentUser?.id)
  if (!account) throw new Error('Sign in again before changing your password.')
  if (typeof currentPassword !== 'string') {
    throw new Error('Current password is incorrect.')
  }
  const currentHash = await hashPassword(currentPassword, account.passwordSalt)
  if (currentHash.hash !== account.passwordHash) {
    throw new Error('Current password is incorrect.')
  }
  if (
    typeof newPassword !== 'string' ||
    newPassword.length < minPasswordLength ||
    newPassword.length > maxPasswordLength ||
    newPassword === currentPassword
  ) {
    throw new Error(`Choose a different password between ${minPasswordLength} and ${maxPasswordLength} characters.`)
  }

  const { salt, hash } = await hashPassword(newPassword)
  writeJson(accountsKey, accounts.map((savedAccount) => (
    savedAccount.id === account.id
      ? { ...savedAccount, passwordSalt: salt, passwordHash: hash }
      : savedAccount
  )))
  return publicAccount(account)
}

export async function signOut() {
  try {
    window.localStorage.removeItem(sessionKey)
  } catch {
    throw new Error('Unable to clear your WorkHelp session from this browser.')
  }
}
