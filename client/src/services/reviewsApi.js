// services/reviewsApi.js - product reviews (public read; auth write with one-per-product rule).
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const reviewsApi = createApi({
  reducerPath: 'reviewsApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Review', 'Product'],
  endpoints: (build) => ({
    getReviews: build.query({
      query: ({ slug, page = 1, limit = 10 }) => ({
        url: `/api/reviews/${encodeURIComponent(slug)}`,
        method: 'GET',
        params: { page, limit },
      }),
      transformResponse: envelope,
      providesTags: (result, error, arg) => [{ type: 'Review', id: arg.slug }],
    }),
    addReview: build.mutation({
      query: ({ slug, ...body }) => ({ url: `/api/reviews/${encodeURIComponent(slug)}`, method: 'POST', data: body }),
      transformResponse: envelope,
      invalidatesTags: (result, error, arg) => [{ type: 'Review', id: arg.slug }, { type: 'Product' }],
    }),
  }),
});

export const { useGetReviewsQuery, useAddReviewMutation } = reviewsApi;
export default reviewsApi;
