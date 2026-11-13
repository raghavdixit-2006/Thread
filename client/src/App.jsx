// App.jsx - providers, routing, session bootstrap, oauth one-time-code consumption.
// The ?oauth= param arrives only from the Google callback redirect (that endpoint
// sets the refresh cookie itself); here the one-time code is exchanged for an
// access token + user, then the query string is cleaned. Route guards: RequireGuest
// keeps signed-in users away from login screens, RequireCustomer keeps staff out
// of the storefront.
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import { bootstrapSession, exchangeOauthCode } from './services/session.js';
import useAuth, { useSessionSync } from './hooks/useSessionSync.js';

import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import RequireAuth from './components/common/RequireAuth.jsx';
import RequireCustomer from './components/common/RequireCustomer.jsx';
import RequireAdmin from './components/common/RequireAdmin.jsx';
import Spinner from './components/common/Spinner.jsx';
import ErrorNote from './components/common/ErrorNote.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import ToastProvider from './components/common/ToastProvider.jsx';

import HomePage from './pages/HomePage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import CartPage from './pages/CartPage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminProductsPage from './pages/AdminProductsPage.jsx';
import AdminProductFormPage from './pages/AdminProductFormPage.jsx';
import PoliciesPage from './pages/PoliciesPage.jsx';
import PolicyPage from './pages/PolicyPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const TITLES = [
  ['/admin/products/new', 'Add a piece - THREAD staff'],
  ['/admin/products', 'Catalogue - THREAD staff'],
  ['/admin/login', 'Staff sign in - THREAD'],
  ['/admin', 'Console - THREAD staff'],
  ['/product/', 'Piece - THREAD'],
  ['/shop', 'The shop - THREAD'],
  ['/cart', 'Your bag - THREAD'],
  ['/wishlist', 'Wishlist - THREAD'],
  ['/checkout', 'Checkout - THREAD'],
  ['/orders', 'Your orders - THREAD'],
  ['/profile', 'Profile - THREAD'],
  ['/policies', 'Policies - THREAD'],
  ['/auth', 'Sign in - THREAD'],
];

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = pathname === '/' ? 'THREAD - editorial clothing' : (match?.[1] || 'THREAD - editorial clothing');
  }, [pathname]);
  return null;
}

/** consumes ?oauth=<oneTimeCode> | ?oauthError=... once, then strips the params */
function OauthLanding() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const oauthCode = searchParams.get('oauth');
    const oauthError = searchParams.get('oauthError');
    if (!oauthCode && !oauthError) return undefined;

    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('oauth');
    cleaned.delete('oauthError');

    let cancelled = false;
    (async () => {
      if (oauthCode) {
        try {
          await exchangeOauthCode(oauthCode);
          navigate(cleaned.toString() ? `${window.location.pathname}?${cleaned}` : window.location.pathname, { replace: true });
        } catch {
          if (!cancelled) {
            sessionStorage.setItem('thread.oauthError', 'Google sign-in link expired or was already used. Please try again.');
            navigate(`/auth${cleaned.toString() ? `?${cleaned}` : ''}`, { replace: true });
          }
        }
        return;
      }
      if (!cancelled) {
        sessionStorage.setItem('thread.oauthError', decodeURIComponent(oauthError || 'Google sign-in failed. Please try again.'));
        navigate(`/auth${cleaned.toString() ? `?${cleaned}` : ''}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, setSearchParams]);

  return null;
}

/** guards /auth (and the staff portal): a signed-in user cannot reach a login screen.
    Admins are bounced to the /admin console; customers to `next` (deep link) or home. */
function RequireGuest({ children }) {
  const [searchParams] = useSearchParams();
  const { user, isAuthed, hydrated } = useAuth();
  if (!hydrated) return <Spinner label="Checking your session" />;
  if (isAuthed) {
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    const next = searchParams.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('/auth') ? next : '/';
    return <Navigate to={safe} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Provider store={store}>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </Provider>
  );
}

function AppShell() {
  useSessionSync(); // session.js events -> authSlice (+ user-scope cache sync, cart merge)

  useEffect(() => {
    bootstrapSession(); // resolves the refresh cookie at boot (if any)
  }, []);

  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollToTop />
      <RouteTitle />
      <OauthLanding />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <ErrorBoundary>
          <Routes>
            {/* storefront surfaces stay open to guests but never show an admin the shop */}
            <Route path="/" element={<RequireCustomer><HomePage /></RequireCustomer>} />
            <Route path="/shop" element={<RequireCustomer><ShopPage /></RequireCustomer>} />
            <Route path="/product/:slug" element={<RequireCustomer><ProductPage /></RequireCustomer>} />
            <Route path="/auth" element={<RequireGuest><AuthPage /></RequireGuest>} />
            <Route path="/admin/login" element={<RequireGuest><AdminLoginPage /></RequireGuest>} />
            {/* cart stays accessible to guests (local bag); others require a session */}
            <Route path="/cart" element={<RequireCustomer><CartPage /></RequireCustomer>} />
            <Route path="/wishlist" element={<RequireCustomer><RequireAuth><WishlistPage /></RequireAuth></RequireCustomer>} />
            <Route path="/checkout" element={<RequireCustomer><RequireAuth><CheckoutPage /></RequireAuth></RequireCustomer>} />
            <Route path="/orders" element={<RequireCustomer><RequireAuth><OrdersPage /></RequireAuth></RequireCustomer>} />
            <Route path="/orders/:id" element={<RequireCustomer><RequireAuth><OrderDetailPage /></RequireAuth></RequireCustomer>} />
            <Route path="/profile" element={<RequireCustomer><RequireAuth><ProfilePage /></RequireAuth></RequireCustomer>} />
            {/* staff area: RequireAdmin sends guests to the portal, customers home */}
            <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
            <Route path="/admin/products" element={<RequireAdmin><AdminProductsPage /></RequireAdmin>} />
            <Route path="/admin/products/new" element={<RequireAdmin><AdminProductFormPage mode="new" /></RequireAdmin>} />
            <Route path="/admin/products/:slug/edit" element={<RequireAdmin><AdminProductFormPage mode="edit" /></RequireAdmin>} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/:slug" element={<PolicyPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
