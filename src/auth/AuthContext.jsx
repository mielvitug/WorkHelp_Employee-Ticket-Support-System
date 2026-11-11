import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './context'
import { getCurrentUser, signIn, signOut } from '../data/authApi'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let active = true
    getCurrentUser().then(
      (currentUser) => {
        if (active) {
          setUser(currentUser)
          setLoading(false)
        }
      },
      (error) => {
        if (active) {
          setSessionError(error.message)
          setLoading(false)
        }
      },
    )
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    async login(email, password) {
      const signedInUser = await signIn(email, password)
      setSessionError('')
      setUser(signedInUser)
      return signedInUser
    },
    async logout() {
      await signOut()
      setUser(null)
    },
  }), [user, loading, sessionError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
