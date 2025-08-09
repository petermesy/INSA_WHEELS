
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import AdminDashboard from '@/components/AdminDashboard';
import { useToast } from '@/hooks/use-toast';

const AdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is authenticated and is an admin
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    const userIo = localStorage.getItem('user');

    if (!token || (!userInfo && !userIo)) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to access this page.',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    // Prefer user_info, fallback to user
    let user = null;
    try {
      user = JSON.parse(userInfo || userIo || '{}');
    } catch (e) {
      user = null;
    }

    // Debug: log user and role
    // Remove or comment out after debugging
    // eslint-disable-next-line no-console
    console.log('AdminPage user:', user);
    // eslint-disable-next-line no-console
    console.log('AdminPage user.role:', user && user.role);

    const allowedRoles = ['admin', 'ADMIN', 'DISTRIBUTOR', 'HEAD_OF_DISTRIBUTOR'];
    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        variant: 'destructive',
      });
      navigate('/login');
    }
  }, [navigate, toast]);

  
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header userType="admin" onLogout={handleLogout} />
      
      <main className="flex-1 py-6">
        <AdminDashboard />
      </main>
    </div>
  );
};

export default AdminPage;
