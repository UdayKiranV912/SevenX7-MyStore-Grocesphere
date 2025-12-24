
import React, { useState } from 'react';
import { UserState } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';
import { SuperAdminApp } from './components/admin/SuperAdminApp';

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
        isAuthenticated: true
    });
  };

  const handleLogout = () => {
    setUser({ isAuthenticated: false, phone: '', location: null, role: 'store_owner' });
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

  const handleUpdateUser = (updatedData: Partial<UserState>) => {
      setUser(prev => ({ ...prev, ...updatedData }));
  };

  if (!user.isAuthenticated) {
    return (
        <Auth 
            onLoginSuccess={handleLoginSuccess} 
            onDemoLogin={handleDemoLogin}
            onCustomerDemoLogin={() => {}} // Disabled
        />
    );
  }

  // Super Admin view for approving merchants
  if (user.role === 'super_admin') {
      return <SuperAdminApp user={user} onLogout={handleLogout} />;
  }

  // Default view is the Store Terminal
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
