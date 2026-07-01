import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; 
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, authStatus, setAuthStatus } = useAuth();
  
  // Estado para controlar el Modal
  const [modalInfo, setModalInfo] = useState({
    show: false,
    title: '',
    message: '',
    type: '', // 'success', 'warning', 'error'
    onConfirm: null
  });
  const [hasShownSuccess, setHasShownSuccess] = useState(false);

  useEffect(() => {
    if (user && !hasShownSuccess) {
      setHasShownSuccess(true);
      setModalInfo({
        show: true,
        type: 'success',
        title: '¡Sesión Iniciada!',
        message: `Hola ${user.nombre || 'Administrador'}, has iniciado sesión correctamente. Haz clic abajo para ingresar al Panel.`,
        onConfirm: () => navigate('/admin')
      });
    }
  }, [user, navigate, hasShownSuccess]);

  useEffect(() => {
    if (authStatus === 'NEW_CREATED') {
      setModalInfo({
        show: true,
        type: 'success',
        title: '¡Solicitud Recibida!',
        message: 'Tu cuenta ha sido creada con éxito. Para mantener la seguridad de la plataforma, un administrador debe aprobar tu acceso antes de que puedas ingresar.',
        onConfirm: () => setAuthStatus(null)
      });
    } else if (authStatus === 'PENDING') {
      setModalInfo({
        show: true,
        type: 'warning',
        title: 'Cuenta en Revisión',
        message: 'Tu cuenta ya está registrada, pero aún se encuentra en espera de aprobación por un administrador.',
        onConfirm: () => setAuthStatus(null)
      });
    } else if (authStatus === 'REJECTED') {
      setModalInfo({
        show: true,
        type: 'error',
        title: 'Acceso Denegado',
        message: 'Lo sentimos, tu solicitud de acceso ha sido rechazada por el administrador.',
        onConfirm: () => setAuthStatus(null)
      });
    }
  }, [authStatus, setAuthStatus]);

  const handleGoogleLogin = async () => {
    try {
      sessionStorage.setItem('logging_in', 'true');
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
      sessionStorage.removeItem('logging_in');
      setModalInfo({
        show: true,
        type: 'error',
        title: 'Error de Conexión',
        message: 'Ocurrió un error inesperado al intentar iniciar sesión. Por favor inténtalo de nuevo.',
        onConfirm: null
      });
    }
  };

  const closeModal = () => {
    const confirmCallback = modalInfo.onConfirm;
    setModalInfo({ ...modalInfo, show: false });
    if (confirmCallback) {
      confirmCallback();
    }
  };

  return (
    <div className="login-container">
      {/* TARJETA DE LOGIN LIMPIA */}
      <div className="login-card">
        <h2 className="login-title">Bienvenido</h2>
        <p className="login-description">
          Accede al panel de administración de la Rifa Solidaria.
        </p>
        
        {/* BOTÓN GOOGLE */}
        <button 
          onClick={handleGoogleLogin} 
          className="google-btn" 
          type="button"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            className="google-icon" 
          />
          Continuar con Google
        </button>

        {/* BOTÓN VOLVER */}
        <button 
            onClick={() => navigate('/')} 
            className="back-btn" 
            type="button"
        >
            ← Volver al inicio
        </button>
      </div>

      {/* COMPONENTE MODAL CONDICIONAL */}
      {modalInfo.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="modal-icon">
              {modalInfo.type === 'success' && '✅'}
              {modalInfo.type === 'warning' && '⏳'}
              {modalInfo.type === 'error' && '❌'}
            </span>
            
            <h3 className="modal-title">{modalInfo.title}</h3>
            <p className="modal-body">{modalInfo.message}</p>

            {modalInfo.title === '¡Solicitud Recibida!' && (
              <div className="modal-steps">
                <strong>Pasos a seguir:</strong>
                <ul>
                  <li>Se ha notificado al administrador vía correo.</li>
                  <li>Espera a que tu cuenta sea aprobada.</li>
                  <li>Vuelve a intentar iniciar sesión más tarde.</li>
                </ul>
              </div>
            )}

            <button onClick={closeModal} className="modal-btn">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;