// services/authApi.js - RTK Query endpoints for the auth module.
// Response is `res.data` (the envelope payload): { status, accessToken?, user } or
// { status: 'otp-sent', requiresOtp, purpose } / { status: 'reset-authorized', resetToken }.
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Me'],
  endpoints: (build) => ({
    register: build.mutation({
      query: (body) => ({ url: '/api/auth/register', method: 'POST', data: body, skipAuth: true }),
      transformResponse: envelope,
    }),
    login: build.mutation({
      query: (body) => ({ url: '/api/auth/login', method: 'POST', data: body, skipAuth: true }),
      transformResponse: envelope,
    }),
    adminLogin: build.mutation({
      query: (body) => ({ url: '/api/admin/login', method: 'POST', data: body, skipAuth: true }),
      transformResponse: envelope,
    }),
    sendOtp: build.mutation({
      query: (body) => ({ url: '/api/auth/otp/send', method: 'POST', data: body, skipAuth: true }),
      transformResponse: envelope,
    }),
    verifyOtp: build.mutation({
      query: (body) => ({ url: '/api/auth/otp/verify', method: 'POST', data: body, skipAuth: true }),
      transformResponse: envelope,
    }),
    completeReset: build.mutation({
      query: (body) => ({ url: '/api/auth/reset/complete', method: 'POST', data: body, skipAuth: true }),
      transformResponse: envelope,
    }),
    googleUrl: build.query({
      query: (redirect) => ({ url: '/api/auth/google/url', method: 'GET', params: { redirect }, skipAuth: true }),
      transformResponse: envelope,
    }),
    me: build.query({
      query: () => ({ url: '/api/auth/me', method: 'GET' }),
      transformResponse: envelope,
      providesTags: ['Me'],
    }),
    updateProfile: build.mutation({
      query: (body) => ({ url: '/api/auth/me', method: 'PATCH', data: body }),
      transformResponse: envelope,
      invalidatesTags: ['Me'],
    }),
    logout: build.mutation({
      query: () => ({ url: '/api/auth/logout', method: 'POST' }),
      transformResponse: envelope,
      invalidatesTags: ['Me'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useAdminLoginMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useCompleteResetMutation,
  useGoogleUrlQuery,
  useLazyGoogleUrlQuery,
  useMeQuery,
  useUpdateProfileMutation,
  useLogoutMutation,
} = authApi;

