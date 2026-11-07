// store/authSlice.js - who is signed in (synced from session.js via useSessionSync).
// The access token itself never enters Redux - it stays in memory in services/session.js.
import { createSlice } from '@reduxjs/toolkit';

const initialState = { user: null, hasToken: false, hydrated: false };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** token+user emitted by session.js; user may be undefined on token-only refresh */
    sessionUpdated(state, { payload }) {
      const { hasToken, user } = payload;
      if (user !== undefined) state.user = user;
      state.hasToken = Boolean(hasToken);
      state.hydrated = true;
    },
    sessionCleared(state) {
      state.user = null;
      state.hasToken = false;
      state.hydrated = true;
    },
  },
});

export const { sessionUpdated, sessionCleared } = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectIsAuthed = (state) =>
  state.auth.hasToken && Boolean(state.auth.user) && typeof state.auth.user === 'object';
export const selectAuthHydrated = (state) => state.auth.hydrated;

export default authSlice.reducer;


