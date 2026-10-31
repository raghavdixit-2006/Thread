// utils/urls.js
import { env } from '../core/env.js';

export const hostUrl = (path = '') => new URL(path, env.HOST_URL).toString();
export const clientUrl = (path = '') => new URL(path, env.CLIENT_URL).toString();
