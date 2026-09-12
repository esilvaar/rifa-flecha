import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../services/supabase';

export const AuthContext = createContext({
  user: null,
  loading: true,
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isProcessing = useRef(false);

  /**
   * Inicio de sesión nativo con Supabase Auth (Email + Contraseña)
   */
  const loginWithEmail = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al iniciar sesión con Supabase:', error);
      throw error;
    }
  };

  /**
   * Registro de nuevo usuario en Supabase Auth
   */
  const registerWithEmail = async (email, password, nombre) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: nombre,
            nombre: nombre,
          },
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al registrarse con Supabase:', error);
      throw error;
    }
  };

  /**
   * Inicio de sesión opcional con Google OAuth
   */
  const loginWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      throw error;
    }
  };

  /**
   * Cerrar sesión en Supabase
   */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('active_org_id');
      sessionStorage.removeItem('logging_in');
    }
  };

  useEffect(() => {
    let active = true;

    const syncUserProfile = (authUser) => {
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const nombre =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.nombre ||
        authUser.email?.split('@')[0] ||
        'Usuario';

      setUser({
        ...authUser,
        nombre,
      });
      setLoading(false);
    };

    // 1. Obtener sesión activa al iniciar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Suscribirse a cambios de estado de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) {
          await syncUserProfile(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;