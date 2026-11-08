// services/usersApi.js - address book owned by the account module.
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Addresses'],
  endpoints: (build) => ({
    listAddresses: build.query({
      query: () => ({ url: '/api/users/me/addresses', method: 'GET' }),
      transformResponse: envelope,
      providesTags: ['Addresses'],
    }),
    addAddress: build.mutation({
      query: (body) => ({ url: '/api/users/me/addresses', method: 'POST', data: body }),
      transformResponse: envelope,
      invalidatesTags: (result, error) => (error ? [] : ['Addresses']),
    }),
    patchAddress: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/users/me/addresses/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error) => (error ? [] : ['Addresses']),
    }),
    removeAddress: build.mutation({
      query: (id) => ({ url: `/api/users/me/addresses/${id}`, method: 'DELETE' }),
      invalidatesTags: (result, error) => (error ? [] : ['Addresses']),
    }),
    setDefaultAddress: build.mutation({
      query: (id) => ({ url: `/api/users/me/addresses/${id}/default`, method: 'PATCH' }),
      transformResponse: envelope,
      invalidatesTags: (result, error) => (error ? [] : ['Addresses']),
    }),
  }),
});

export const {
  useListAddressesQuery,
  useAddAddressMutation,
  usePatchAddressMutation,
  useRemoveAddressMutation,
  useSetDefaultAddressMutation,
} = usersApi;

export default usersApi;
