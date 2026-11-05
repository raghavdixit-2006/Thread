// services/policiesApi.js - legal pages (privacy, refund, terms, shipping...).
// Single-slug response data: { policy: { slug, title, bodyMarkdown, version, effectiveDate, updatedAt } }
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const policiesApi = createApi({
  reducerPath: 'policiesApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Policy'],
  endpoints: (build) => ({
    listPolicies: build.query({
      query: () => ({ url: '/api/policies', method: 'GET' }),
      transformResponse: envelope,
      providesTags: [{ type: 'Policy', id: 'LIST' }],
    }),
    getPolicy: build.query({
      query: (slug) => ({ url: `/api/policies/${encodeURIComponent(slug)}`, method: 'GET' }),
      transformResponse: (res) => res.data.policy,
      providesTags: (policy) => [{ type: 'Policy', id: policy?.slug }],
    }),
  }),
});

export const { useListPoliciesQuery, useGetPolicyQuery } = policiesApi;
export default policiesApi;
