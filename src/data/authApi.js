async function request(path, options) {
  let response
  try {
    response = await fetch(`/api/auth${path}`, {
      credentials: 'same-origin',
      ...options,
    })
  } catch {
    throw new Error('Unable to connect to the WorkHelp API. Start the API server and try again.')
  }

  if (response.status === 204) return null

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(
      `The WorkHelp API returned a non-JSON response (HTTP ${response.status}). Start the API on 127.0.0.1:3001, then restart Vite.`,
    )
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('The WorkHelp API returned an invalid response.')
  }

  if (!response.ok) {
    throw new Error(body.error ?? 'The WorkHelp API request failed.')
  }

  return body
}

export async function getCurrentUser() {
  const result = await request('/session')
  return result.user
}

export async function signIn(email, password) {
  const result = await request('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return result.user
}

export async function signOut() {
  await request('/logout', { method: 'POST' })
}
