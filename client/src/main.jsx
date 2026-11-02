// main.jsx - entry: root render + guest-cart persistence subscription.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { store } from './store/store.js';
import { GUEST_CART_STORAGE_KEY } from './utils/constants.js';
import './styles/main.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// persist the guest bag on every cart change (subscriber pattern, no reducer side effects)
store.subscribe(() => {
  try {
    const lines = store.getState().cart.guestItems;
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // storage full/blocked - the in-memory bag still works for this session
  }
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
