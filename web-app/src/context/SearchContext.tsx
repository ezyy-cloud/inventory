import { createContext, useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type SearchContextValue = {
  query: string
  setQuery: (q: string) => void
  submitSearch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const submitSearch = useCallback(() => {
    const q = query.trim()
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
  }, [query, navigate])

  return (
    <SearchContext.Provider value={{ query, setQuery, submitSearch }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  return ctx ?? { query: '', setQuery: () => {}, submitSearch: () => {} }
}
