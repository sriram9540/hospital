import React from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { LandingPage } from './pages/Landing/LandingPage.js';

export default function App() {
  return (
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  );
}
