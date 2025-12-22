
import React, { useState } from 'react';
import { UserState } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState>({
      isAuthenticated: false,
      phone: '',
      location: null,
      role: 'store_owner' 
  });

  const handleLoginSuccess = (userData: UserState) => {
    setUser({
        ...userData,
        isAuthenticated: true,
        role: 'store_owner' 
    });
  };

  const handleStoreDemoLogin = () => {
    setUser({
      isAuthenticated: true,
      id: 'demo-user',
      name: 'Demo Store Owner',
      phone: '9999999999',
      location: { lat: 12.9716, lng: 77.5946 },
      address: 'Indiranagar, Bangalore',
      role: 'store_owner',
      gstNumber: '29DEMO0000A1Z5',
      licenseNumber: 'L-DEMO-777'
    });
  };

  const handleLogout = () => {
    setUser({ isAuthenticated: false, phone: '', location: null, role: 'store_owner' });
  };

  if (!user.isAuthenticated) {
    return (
        <Auth 
            onLoginSuccess={handleLoginSuccess} 
            onDemoLogin={handleStoreDemoLogin} 
            onCustomerDemoLogin={() => {}} 
        />
    );
  }

  // All users (Real & Demo) enter the Merchant Portal
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
