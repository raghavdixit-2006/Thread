// components/layout/Footer.jsx - legacy footer grid + service notes; legal links from the API policy module.
import { Link } from 'react-router-dom';

export const POLICY_LINKS = [
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms-of-service', label: 'Terms of Service' },
  { slug: 'refund-policy', label: 'Refund Policy' },
  { slug: 'shipping-policy', label: 'Shipping Policy' },
  { slug: 'cancellation-policy', label: 'Cancellation Policy' },
  { slug: 'cookie-policy', label: 'Cookie Policy' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand">THREAD</Link>
          <p>Editorial clothing for a calmer everyday. Jackets, shirts and soft cotton tees, delivered across India.</p>
        </div>

        <nav className="footer-col" aria-label="Shop">
          <h4>Shop</h4>
          <Link to="/shop?category=jackets">Jackets</Link>
          <Link to="/shop?category=shirts">Shirts</Link>
          <Link to="/shop?category=t-shirts">T-shirts</Link>
          <Link to="/shop">All pieces</Link>
        </nav>

        <nav className="footer-col" aria-label="Account">
          <h4>Account</h4>
          <Link to="/auth">Sign in</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/profile">Profile</Link>
        </nav>

        <nav className="footer-col" aria-label="Help">
          <h4>Help</h4>
          {POLICY_LINKS.map((policy) => (
            <Link key={policy.slug} to={`/policies/${policy.slug}`}>{policy.label}</Link>
          ))}
        </nav>

        <div className="footer-service">
          <h4>Delivery and payment</h4>
          <p>Free standard shipping over Rs 2,000. Cash on delivery, UPI and cards via Razorpay.</p>
          <Link to="/policies/shipping-policy" className="text-link">
            Shipping details <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>THREAD - editorial clothing, made in India</span>
        <span>Cash on delivery - UPI - cards</span>
      </div>
    </footer>
  );
}
