// utils/response.js - deterministic API envelopes (backend skill §4).
export const ok = (res, data, meta = undefined) => res.json({ success: true, data, ...(meta ? { meta } : {}) });
export const created = (res, data, meta = undefined) => res.status(201).json({ success: true, data, ...(meta ? { meta } : {}) });
export const noContent = (res) => res.status(204).send();
