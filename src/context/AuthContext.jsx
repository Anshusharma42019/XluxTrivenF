import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('crmUser') || 'null'));

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem('crmTokens') || 'null');
    if (tokens && tokens.access && tokens.access.token) {
      API.get('/users/me').then(res => {
        if (res.data && res.data.data) {
          localStorage.setItem('crmUser', JSON.stringify(res.data.data));
          setUser(res.data.data);
        }
      }).catch(() => {});
    }
  }, []);

  const login = async (form) => {
    const payload = { role: form.role, password: form.password };
    if (form.role === 'admin') payload.email = form.email;
    else payload.phone = form.phone;
    const { data } = await API.post('/auth/login', payload);
    localStorage.setItem('crmUser', JSON.stringify(data.data.user));
    localStorage.setItem('crmTokens', JSON.stringify(data.data.tokens));
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem('crmTokens') || 'null');
      await API.post('/auth/logout', { refreshToken: tokens?.refresh?.token });
    } catch { /* ignore */ }
    localStorage.removeItem('crmUser');
    localStorage.removeItem('crmTokens');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem('crmUser', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
