
import React, { useState } from 'react';
import { UserState } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';
import { CustomerApp } from './components/customer/CustomerApp';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState>({
      isAuthenticated: false,
      phone: '',
      location: null,
      role: 'customer' 
  });

  const handleLoginSuccess = (userData: UserState) => {
    setUser({
        ...userData,
        isAuthenticated: true
    });
  };

  const handleLogout = () => {
    setUser({ isAuthenticated: false, phone: '', location: null, role: 'customer' });
  };

  const handleDemoLogin = () => {
    setUser({
        isAuthenticated: true,
        id: 'demo-user',
        name: 'Partner Demo',
        phone: '9999900000',
        role: 'store_owner',
        verificationStatus: 'verified'
    });
  };

  const handleCustomerDemoLogin = () => {
    setUser({
        isAuthenticated: true,
        id: 'demo-customer',
        name: 'Demo Customer',
        phone: '8888800000',
        role: 'customer'
    });
  };

  const handleUpdateUser = (updatedData: Partial<UserState>) => {
      setUser(prev => ({ ...prev, ...updatedData }));
  };

  if (!user.isAuthenticated) {
    return (
        <Auth 
            onLoginSuccess={handleLoginSuccess} 
            onDemoLogin={handleDemoLogin}
            onCustomerDemoLogin={handleCustomerDemoLogin}
        />
    );
  }

  // Role-based navigation
  if (user.role === 'store_owner') {
      return <StoreApp user={user} onLogout={handleLogout} />;
  }

  return (
    <CustomerApp 
      user={user} 
      onLogout={handleLogout} 
      onUpdateUser={handleUpdateUser} 
    />
  );
};

export default App;
