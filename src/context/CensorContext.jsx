import { createContext, useContext, useState, useCallback } from 'react'

const CensorContext = createContext(null)

const MASK = '••••••'

export function CensorProvider({ children }) {
  const [censored, setCensored] = useState(
    () => localStorage.getItem('censor') === 'true'
  )

  const toggle = useCallback(() => {
    setCensored(c => {
      localStorage.setItem('censor', String(!c))
      return !c
    })
  }, [])

  /** Pass a formatted dollar string — returns it or the mask */
  const mask = useCallback(
    (formatted) => (censored ? MASK : formatted),
    [censored]
  )

  return (
    <CensorContext.Provider value={{ censored, toggle, mask }}>
      {children}
    </CensorContext.Provider>
  )
}

export function useCensor() {
  const ctx = useContext(CensorContext)
  if (!ctx) throw new Error('useCensor must be used within CensorProvider')
  return ctx
}
