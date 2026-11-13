// pages/NotFoundPage.jsx - missed routes, editorial tone.
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container section" style={{ textAlign: 'center', paddingTop: 90 }}>
      <p className="eyebrow">Error 404</p>
      <h1>This page changed its fit</h1>
      <p className="lead" style={{ maxWidth: '48ch', margin: '0 auto 28px' }}>
        The address you tried does not exist on THREAD. The full catalog is one click away.
      </p>
      <Link to="/shop" className="btn">Back to the shop</Link>
    </div>
  );
}
