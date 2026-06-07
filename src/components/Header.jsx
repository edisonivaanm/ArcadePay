import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../firebase/auth';
import EditProfileModal from './EditProfileModal';

export default function Header() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          {/* Logo */}
          <div className="header__logo">
            <span className="header__logo-text">ArcadePay</span>
          </div>

          {/* Right side */}
          <div className="header__right">
            {/* Avatar — click to edit profile */}
            <button
              id="btn-edit-profile"
              onClick={() => setShowEdit(true)}
              className="header__avatar-btn"
              title="Editar perfil"
            >
              <div className="header__avatar">
                <UserIcon />
              </div>
            </button>

            {/* Logout — oval red pill button */}
            <button
              id="btn-logout"
              onClick={handleLogout}
              disabled={loggingOut}
              className="header__logout-btn"
              title="Cerrar sesión"
            >
              {loggingOut
                ? <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} />
                : <LogoutIcon />
              }
            </button>
          </div>
        </div>
      </header>

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
    </>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
