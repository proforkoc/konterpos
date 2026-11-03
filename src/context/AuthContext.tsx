import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserRole, AppUser } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  operatorName: string;
  setOperatorName: (name: string) => void;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  // Terminal Lock / Shift Management
  isLocked: boolean;
  activeStaff: AppUser | null;
  unlockTerminal: (staff: AppUser) => void;
  lockTerminal: () => void;
  // Permissions
  canViewCostPrice: boolean;
  canViewAnalytics: boolean;
  canManageInventory: boolean;
  canManageUsers: boolean;
  canManageExpenses: boolean;
  canAccessServiceDesk: boolean;
  canAccessPOS: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  operatorName: 'Kasir Utama',
  setOperatorName: () => {},
  currentRole: 'cashier',
  switchRole: () => {},
  isLocked: true,
  activeStaff: null,
  unlockTerminal: () => {},
  lockTerminal: () => {},
  canViewCostPrice: false,
  canViewAnalytics: false,
  canManageInventory: false,
  canManageUsers: false,
  canManageExpenses: false,
  canAccessServiceDesk: false,
  canAccessPOS: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Terminal Lockscreen State
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return sessionStorage.getItem('konter_terminal_unlocked') !== 'true';
  });

  const [activeStaff, setActiveStaff] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('konter_active_staff');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (localStorage.getItem('konter_user_role') as UserRole) || 'cashier';
  });

  const [customOperator, setCustomOperator] = useState<string>(() => {
    return localStorage.getItem('konter_operator_name') || 'Siti (Kasir)';
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        try {
          // Sync with PostgreSQL backend
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email,
              name: currentUser.displayName || 'Owner Konter',
            }),
          });
          const dbUser = await res.json();
          if (dbUser?.role) {
            setCurrentRole(dbUser.role);
            localStorage.setItem('konter_user_role', dbUser.role);
            // Google login automatically unlocks as owner
            unlockTerminal(dbUser);
          }
        } catch {
          // silent sync failure
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/popup-blocked'
      ) {
        return;
      }
      console.warn('Google Sign-in info:', err?.message || err);
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      lockTerminal();
    } catch (err: any) {
      console.warn('Sign-out info:', err?.message || err);
    }
  };

  const unlockTerminal = (staff: AppUser) => {
    setActiveStaff(staff);
    setCurrentRole(staff.role);
    setCustomOperator(staff.name);
    setIsLocked(false);
    sessionStorage.setItem('konter_terminal_unlocked', 'true');
    localStorage.setItem('konter_user_role', staff.role);
    localStorage.setItem('konter_operator_name', staff.name);
    localStorage.setItem('konter_active_staff', JSON.stringify(staff));
  };

  const lockTerminal = () => {
    setIsLocked(true);
    sessionStorage.removeItem('konter_terminal_unlocked');
  };

  const setOperatorName = (name: string) => {
    setCustomOperator(name);
    localStorage.setItem('konter_operator_name', name);
  };

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('konter_user_role', role);

    if (!user) {
      if (role === 'owner') setOperatorName('Hendra (Owner Toko)');
      else if (role === 'manager') setOperatorName('Budi (Kepala Toko)');
      else if (role === 'cashier') setOperatorName('Siti (Kasir Shift)');
      else if (role === 'technician') setOperatorName('Dani (Teknisi Software)');
    }
  };

  const operatorName = user?.displayName || user?.email?.split('@')[0] || customOperator;

  // RBAC Permission Gates
  const canViewCostPrice = currentRole === 'owner' || currentRole === 'manager';
  const canViewAnalytics = currentRole === 'owner' || currentRole === 'manager';
  const canManageInventory = currentRole === 'owner' || currentRole === 'manager';
  const canManageUsers = currentRole === 'owner';
  const canManageExpenses = currentRole === 'owner' || currentRole === 'manager';
  const canAccessServiceDesk = currentRole === 'owner' || currentRole === 'manager' || currentRole === 'technician';
  const canAccessPOS = currentRole === 'owner' || currentRole === 'manager' || currentRole === 'cashier';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signOut,
        operatorName,
        setOperatorName,
        currentRole,
        switchRole,
        isLocked,
        activeStaff,
        unlockTerminal,
        lockTerminal,
        canViewCostPrice,
        canViewAnalytics,
        canManageInventory,
        canManageUsers,
        canManageExpenses,
        canAccessServiceDesk,
        canAccessPOS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
