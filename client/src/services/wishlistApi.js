// services/wishlistApi.js - product wishlist (auth scope, toggle + list + per-item states).
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const wishlistApi = createApi({
  reducerPath: 'wishlistApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Wishlist'],
  endpoints: (build) => ({
    getWishlist: build.query({
      query: () => ({ url: '/api/wishlist', method: 'GET' }),
      transformResponse: envelope,
      providesTags: ['Wishlist'],
    }),
    wishlistStates: build.query({
      query: (ids) => ({ url: '/api/wishlist/states', method: 'GET', params: { ids: ids.join(',') } }),
      transformResponse: envelope,
      providesTags: (result) => result?.states
        ? [...result.states.map((s) => ({ type: 'Wishlist', id: s.productId })), { type: 'Wishlist', id: 'STATES' }]
        : [{ type: 'Wishlist', id: 'STATES' }],
    }),
    toggleWishlist: build.mutation({
      query: ({ productId }) => ({ url: '/api/wishlist/toggle', method: 'POST', data: { productId } }),
      transformResponse: envelope,
      invalidatesTags: (result) => [{ type: 'Wishlist', id: 'STATES' }, { type: 'Wishlist' }],
    }),
  }),
});

export const { useGetWishlistQuery, useWishlistStatesQuery, useToggleWishlistMutation, useLazyWishlistStatesQuery } = wishlistApi;
export default wishlistApi;
