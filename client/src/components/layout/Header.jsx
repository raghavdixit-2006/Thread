// components/layout/Header.jsx - legacy nav, responsive: brand row, uppercase links,
// search on wide screens, hamburger + mobile menu below 1024px, account dropdown.
// Staff session: minimal console chrome (staff variant below); staff sign-out reloads
// into the portal (see handleLogout), shopper sign-out stays in the SPA.
import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import useAuth from '../../hooks/useSessionSync.js';
import { useGetCartQuery } from '../../services/cartApi.js';
import { useMeQuery } from '../../services/authApi.js';
import { selectCartCount, clearWholeCart } from '../../store/cartSlice.js';
import { useLogoutMutation } from '../../services/authApi.js';
import { clearSession } from '../../services/session.js';
import SearchBox from '../features/SearchBox.jsx';

const navClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

export default function Header() {
  const { user, isAuthed } = useAuth();
  // staff chrome: admins never see retail nav (cart/wishlist/search/shop) at all
  const isStaff = Boolean(isAuthed && user?.role === 'admin');
  // keep the server cart warm for the badge (and every page that reads the snapshot)
  useGetCartQuery(undefined, { skip: !isAuthed });
  // canonical identity from the server (never trusts a token-shaped user object)
  const me = useMeQuery(undefined, { skip: !isAuthed });
  const displayName = me.data?.name || (user?.name || 'there').split(' ')[0];
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef(null);
  const drawerRef = useRef(null);
  const toggleRef = useRef(null);

  const [apiLogout] = useLogoutMutation();
  const count = useSelector(selectCartCount);

  useEffect(() => {
    function onOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('click', onOutside);
    return () => document.removeEventListener('click', onOutside);
  }, []);

  // a route change always closes the drawer (deep links, sign-in redirects)
  useEffect(() => {
    setNavOpen(false);
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  // drawer behaves like a disclosure: Escape closes it, focus moves into it and returns
  useEffect(() => {
    if (!navOpen) return undefined;
    const first = drawerRef.current?.querySelector('a, button, input');
    first?.focus({ preventScroll: true });
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setNavOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  function closeMobile() {
    setNavOpen(false);
  }

  async function handleLogout() {
    setMenuOpen(false);
    closeMobile();
    const destination = isStaff ? '/admin/login' : '/';
    try {
      await apiLogout().unwrap(); // server revokes the refresh family + clears the cookie
    } catch {
      // cookie may already be gone
    }
    try {
      await clearWholeCart();
    } catch {
      // an expired token here should never block sign-out
    }
    clearSession(); // emits null -> sessionCleared; user-scope caches reset in useSessionSync
    // staff: the portal landing is a fresh boot (full reload). An SPA transition loses the
    // race here by construction: while the router transition renders, the unauthed flip
    // flushes on the OLD route and a dev-mode double-invoked Navigate bounce overtakes the
    // landing. Customers stay in the SPA - their landing routes are guest-safe.
    if (isStaff) {
      window.location.assign('/admin/login');
      return;
    }
    navigate(destination, { replace: true });
  }

  // staff variant: brand, console/catalogue links, who, sign out
  if (isStaff) {
    return (
      <header className="site-header staff-header">
        <div className="container nav">
          <Link to="/admin" className="brand" aria-label="THREAD staff console">THREAD</Link>

          <nav className="nav-links" aria-label="Staff">
            <NavLink to="/admin" end className="staff-link">Console</NavLink>
            <NavLink to="/admin/products" className="staff-link">Catalogue</NavLink>
            <span className="who">Console - {displayName}</span>
            <button type="button" className="icon-link signout-direct" onClick={handleLogout} title="Sign out">
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header">
      <div className="container nav">
        <Link to="/" className="brand" aria-label="THREAD home">THREAD</Link>

        <nav className="nav-links" aria-label="Primary">
          <button
            type="button"
            className="nav-toggle"
            ref={toggleRef}
            onClick={() => setNavOpen((open) => !open)}
            aria-expanded={navOpen}
            aria-controls="mobile-menu"
          >
            <i className={`bi ${navOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
            <span>Menu</span>
          </button>

          <NavLink to="/shop" className={`hide-md ${navClass}`}>Shop all</NavLink>

          <span className="hide-md"><SearchBox /></span>

          <NavLink to="/wishlist" className="icon-link hide-md" aria-label="Wishlist">
            <i className="bi bi-heart" aria-hidden="true" />
          </NavLink>

          <NavLink to="/cart" className={navClass} aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}>
            <span className="hide-md">Bag</span>
            <span className="cart-bubble" aria-live="polite" aria-atomic="true">{count}</span>
          </NavLink>

          {isAuthed ? (
            <>
              <span className="account" ref={menuRef}>
                <button
                  type="button"
                  className="icon-link account-toggle"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="who">Hi, {displayName}</span>
                  <i className="bi bi-chevron-down" aria-hidden="true" />
                </button>
                {menuOpen && (
                  <span className="account-menu" role="menu">
                    <Link role="menuitem" to="/profile">Profile and addresses</Link>
                    <Link role="menuitem" to="/orders">Orders</Link>
                    <Link role="menuitem" to="/wishlist">Wishlist</Link>
                    <button type="button" role="menuitem" onClick={handleLogout}>Sign out</button>
                  </span>
                )}
              </span>
              <button type="button" className="icon-link signout-direct hide-md" onClick={handleLogout} title="Sign out">
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
                <span className="hide-md">Sign out</span>
              </button>
            </>
          ) : (
            <Link to="/auth" className="login-link">Sign in</Link>
          )}
        </nav>
      </div>

      {navOpen && (
        <nav className="mobile-menu" id="mobile-menu" aria-label="Mobile" ref={drawerRef}>
          <div className="container mobile-menu-inner">
            <div className="mobile-search"><SearchBox /></div>
            <NavLink to="/shop" className={navClass} onClick={closeMobile}>Shop all</NavLink>
            <NavLink to="/wishlist" className={navClass} onClick={closeMobile}>Wishlist</NavLink>
            <NavLink to="/cart" className={navClass} onClick={closeMobile}>
              Bag <span className="cart-bubble">{count}</span>
            </NavLink>
            {isAuthed ? (
              <>
                <NavLink to="/orders" className={navClass} onClick={closeMobile}>Orders</NavLink>
                <NavLink to="/profile" className={navClass} onClick={closeMobile}>Profile and addresses</NavLink>
                <button type="button" onClick={handleLogout}>Sign out</button>
              </>
            ) : (
              <NavLink to="/auth" className={navClass} onClick={closeMobile}>Sign in</NavLink>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
