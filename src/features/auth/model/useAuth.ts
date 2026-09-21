import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from './AuthContext';

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth вызван вне AuthProvider');
  return context;
};
