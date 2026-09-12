import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { routerConfig } from './router/router-config';
import RoleGuard from './components/RoleGuard';
import Login from './pages/Login/Login';
import SaasHome from './pages/Landing/SaasHome';
import Home from './pages/Home/Home';
import Dashboard from './pages/Admin/Dashboard';
import CatalogoVentas from './pages/Vendedor/CatalogoVentas';
import AceptarInvitacion from './pages/Invitacion/AceptarInvitacion';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <HashRouter future={routerConfig.future}>
          <Routes>
            {/* Landing Page Principal del SaaS */}
            <Route path="/" element={<SaasHome />} />

            {/* Página Pública de Compra de Boletos por Rifa */}
            <Route path="/rifa/:rifaId" element={<Home />} />

            {/* Autenticación */}
            <Route path="/login" element={<Login />} />

            {/* Canje de Invitaciones */}
            <Route path="/invitacion" element={<AceptarInvitacion />} />

            {/* Panel de Administración protegido para Admins */}
            <Route
              path="/admin"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Dashboard />
                </RoleGuard>
              }
            />

            {/* Portal de Ventas para Vendedores (también accesible por Admins) */}
            <Route
              path="/vendedor"
              element={
                <RoleGuard allowedRoles={['vendedor', 'admin']}>
                  <CatalogoVentas />
                </RoleGuard>
              }
            />

            {/* Ruta comodín */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;