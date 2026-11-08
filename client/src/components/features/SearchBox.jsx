// components/features/SearchBox.jsx - header search; enters the catalog with the q param.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBox() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!term.trim()) return;
    navigate(`/shop?q=${encodeURIComponent(term.trim())}`);
    setTerm('');
  }

  return (
    <form className="search-box" role="search" onSubmit={submit}>
      <i className="bi bi-search" aria-hidden="true" />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search the catalog..."
        aria-label="Search products"
      />
      <button type="submit" aria-label="Search">
        <i className="bi bi-arrow-right" aria-hidden="true" />
      </button>
    </form>
  );
}
