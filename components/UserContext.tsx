import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define User type for consistent typing
interface User {
  username: string;
  display_name: string;
  role: string;
}

// Context interface including loading state
interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cvs-cms-user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    }
  }, []);

  // Save user to localStorage on every change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (user) localStorage.setItem('cvs-cms-user', JSON.stringify(user));
      else localStorage.removeItem('cvs-cms-user');
    }
  }, [user]);

  if (loading) return null; // Optionally show spinner instead of null

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
}
