import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  role: string;
  email: string;
}

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (url: string) => Promise<any>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (url: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setIsLoading(false);
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted to prevent race conditions');
      } else {
        setError(err.message || 'An error occurred');
        setIsLoading(false);
      }
      throw err;
    }
  }, []);

  return (
    <AppContext.Provider value={{ user, isLoading, error, fetchData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
