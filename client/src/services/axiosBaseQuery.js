// services/axiosBaseQuery.js - RTK Query transport over the app axios instance
// so the silent-refresh interceptor applies to every request uniformly.
import apiClient from './apiClient.js';

export const axiosBaseQuery =
  ({ baseUrl = '' } = {}) =>
  async ({ url, method = 'GET', data, params, headers = {}, skipAuth = false, timeout }) => {
    try {
      const response = await apiClient.request({
        url: `${baseUrl}${url}`,
        method,
        data,
        params,
        headers,
        _skipAuth: skipAuth,
        ...(timeout ? { timeout } : {}),
      });
      return { data: response.data };
    } catch (axiosError) {
      return {
        error: axiosError.api || {
          status: axiosError.response?.status || 0,
          code: 'NETWORK_ERROR',
          message: axiosError.message,
          details: null,
        },
        meta: axiosError.response?.data,
      };
    }
  };
