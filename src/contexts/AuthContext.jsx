import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../services/supabase';
import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from '../config';

const ADMIN_EMAILS = ['eduardo20032110@gmail.com']; 

export const AuthContext = createContext({ 
  user: null, 
  loading: true,
  authStatus: null,
  setAuthStatus: () => {},
  logout: () => Promise.resolve(),
  loginWithGoogle: () => Promise.resolve()
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState(null); // 'NEW_CREATED' | 'PENDING' | 'REJECTED'
  const isProcessing = useRef(false);

  const sendApprovalRequestEmail = async (userData) => {
    const templateParams = {
      user_email: userData.email,
      user_name: userData.nombre,
    };
    try {
      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams,
        EMAILJS_CONFIG.PUBLIC_KEY
      );
    } catch (err) {
      console.warn("⚠️ Correo falló (no crítico):", err);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error General Login:", error);
      throw error;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthStatus(null);
  };

  useEffect(() => {
    let active = true;

    const handleAuthChange = async (event, session) => {
      if (!active) return;

      if (session?.user) {
        // Redirigir al login en el enrutador hash si venimos de un flujo de autenticación activo
        if (sessionStorage.getItem('logging_in') === 'true') {
          sessionStorage.removeItem('logging_in');
          window.location.hash = '/login';
        }

        // Si ya estamos procesando una llamada de autenticación, salimos para evitar race conditions
        if (isProcessing.current) return;
        isProcessing.current = true;

        const { user: authUser } = session;
        const email = authUser.email;
        const uid = authUser.id;

        try {
          // Obtener perfil del usuario de la tabla pública
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

          if (error) {
            console.error("Error leyendo perfil de usuario:", error);
          }

          const isAdminHardcoded = ADMIN_EMAILS.includes(email);

          // A) CASO ADMIN HARDCODED
          if (isAdminHardcoded) {
            let finalProfile = profile;
            if (!profile) {
              finalProfile = {
                id: uid,
                email: email,
                nombre: authUser.user_metadata?.full_name || 'Admin',
                status: 'approved',
                role: 'admin'
              };
              await supabase.from('users').upsert(finalProfile, { onConflict: 'id' });
            }
            setUser({ ...authUser, ...finalProfile });
          }
          // B) USUARIO EXISTENTE APROBADO
          else if (profile && profile.status === 'approved') {
            setUser({ ...authUser, ...profile });
          }
          // C) USUARIO NUEVO O PENDIENTE/RECHAZADO
          else {
            if (!profile) {
              // Crear perfil pendiente para nuevo usuario
              const newUser = {
                id: uid,
                email: email,
                nombre: authUser.user_metadata?.full_name || 'Sin nombre',
                status: 'pending',
                role: 'user'
              };
              // Usar upsert para evitar errores 409 Conflict si se dispara doble
              await supabase.from('users').upsert(newUser, { onConflict: 'id' });
              await sendApprovalRequestEmail(newUser);
              setAuthStatus('NEW_CREATED');
            } else if (profile.status === 'pending') {
              setAuthStatus('PENDING');
            } else {
              setAuthStatus('REJECTED');
            }
            await supabase.auth.signOut();
            setUser(null);
          }
        } catch (err) {
          console.error("Error al procesar el perfil:", err);
          await supabase.auth.signOut();
          setUser(null);
        } finally {
          isProcessing.current = false;
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    // Inicializar estado auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange('SIGNED_IN', session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignorar cambios que no sean inicio/cierre definitivo para evitar bucles durante el signOut
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        handleAuthChange(event, session);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white">Cargando...</div>;

  return (
    <AuthContext.Provider value={{ user, loading, logout, loginWithGoogle, authStatus, setAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;