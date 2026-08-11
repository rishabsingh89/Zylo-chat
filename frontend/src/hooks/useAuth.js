import { useAuthContext } from '../context/AuthContext';

const useAuth = () => {
  const { user, token, login, logout, isAuthenticated } = useAuthContext();
  return { user, token, login, logout, isAuthenticated };
};

export default useAuth;
