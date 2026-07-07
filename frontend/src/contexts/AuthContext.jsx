import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('kiaan_user');
    const token = localStorage.getItem('kiaan_token');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user session");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock validation
      if (email && password) {
        let role = "Super Admin";
        if (email.includes("sales")) role = "Sales Agent";
        if (email.includes("support")) role = "Support Staff";

        const loggedInUser = {
          id: "usr-1",
          firstName: role.split(' ')[0],
          lastName: "User",
          email: email,
          role: role,
          tenantId: "t-1",
          tenantName: "Kiaan Technologies"
        };
        setUser(loggedInUser);
        localStorage.setItem('kiaan_user', JSON.stringify(loggedInUser));
        localStorage.setItem('kiaan_token', "mock-jwt-token-12345");
        return { success: true };
      } else {
        return { success: false, error: 'Invalid credentials' };
      }
    } catch (error) {
      return { success: false, error: 'Network error.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kiaan_user');
    localStorage.removeItem('kiaan_token');
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-white">Loading session...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
