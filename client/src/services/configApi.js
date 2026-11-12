// services/configApi.js - public storefront capabilities (payment methods, gateway mode).
// No secrets: the API answers booleans only. Used to render payment choices the server can honour.
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const configApi = createApi({
  reducerPath: 'configApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (build) => ({
    getConfig: build.query({
      query: () => ({ url: '/api/config', method: 'GET' }),
      transformResponse: envelope,
    }),
  }),
});

export const { useGetConfigQuery } = configApi;
