import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getPortfolios, createPortfolio, renamePortfolio, deletePortfolio } from '../lib/portfolios'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext(null)

export function PortfolioProvider({ children }) {
  const { user } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [activeId, setActiveId]     = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!user) {
      setPortfolios([])
      setActiveId(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    getPortfolios()
      .then(data => {
        if (cancelled) return
        setPortfolios(data)
        setActiveId(prev => {
          const stored = localStorage.getItem('activePortfolio')
          if (stored && data.find(p => p.id === stored)) return stored
          if (data.length > 0) {
            localStorage.setItem('activePortfolio', data[0].id)
            return data[0].id
          }
          return prev
        })
      })
      .catch(e => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [user])

  function switchPortfolio(id) {
    setActiveId(id)
    localStorage.setItem('activePortfolio', id)
  }

  const addPortfolio = useCallback(async (name) => {
    const p = await createPortfolio(name)
    setPortfolios(prev => [...prev, p])
    switchPortfolio(p.id)
    return p
  }, [])

  const renameActive = useCallback(async (id, name) => {
    const p = await renamePortfolio(id, name)
    setPortfolios(prev => prev.map(x => x.id === p.id ? p : x))
  }, [])

  const deleteActive = useCallback(async (id) => {
    if (portfolios.length <= 1) throw new Error('Cannot delete your last portfolio.')
    await deletePortfolio(id)
    const remaining = portfolios.filter(p => p.id !== id)
    setPortfolios(remaining)
    if (id === activeId) switchPortfolio(remaining[0].id)
  }, [portfolios, activeId])

  const active = portfolios.find(p => p.id === activeId) ?? null

  return (
    <PortfolioContext.Provider value={{
      portfolios, active, activeId, loading,
      switchPortfolio, addPortfolio, renameActive, deleteActive,
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
