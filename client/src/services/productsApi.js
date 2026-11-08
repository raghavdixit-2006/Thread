// services/productsApi.js - catalog reads (Mongo listing; q facets from Elasticsearch or the Mongo fallback).
// List response data: { items, meta: {total, page, limit, pages}, facets? }
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const productsApi = createApi({
  reducerPath: 'productsApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Product', 'Related', 'Featured', 'Categories'],
  endpoints: (build) => ({
    getProducts: build.query({
      query: (params = {}) => ({ url: '/api/products', method: 'GET', params }),
      transformResponse: envelope,
      providesTags: (result) =>
        result?.items
          ? [...result.items.map((p) => ({ type: 'Product', id: p._id || p.productId || p.slug })), { type: 'Product', id: 'LIST' }]
          : [{ type: 'Product', id: 'LIST' }],
    }),
    getProduct: build.query({
      query: (slug) => ({ url: `/api/products/${encodeURIComponent(slug)}`, method: 'GET' }),
      transformResponse: (res) => res.data.product,
      providesTags: (product) => [{ type: 'Product', id: product?._id || product?.slug }],
    }),
    getRelated: build.query({
      query: (slug) => ({ url: `/api/products/${encodeURIComponent(slug)}/related`, method: 'GET' }),
      transformResponse: envelope,
      providesTags: (result) => [{ type: 'Related', id: 'LIST' }],
    }),
    getFeatured: build.query({
      query: () => ({ url: '/api/products/featured', method: 'GET' }),
      transformResponse: envelope,
      providesTags: [{ type: 'Featured', id: 'LIST' }],
    }),
    getCategories: build.query({
      query: () => ({ url: '/api/products/categories', method: 'GET' }),
      transformResponse: envelope,
      providesTags: [{ type: 'Categories', id: 'LIST' }],
    }),

    // ------- admin catalogue management (RBAC server-side) -------
    adminListProducts: build.query({
      query: (params = {}) => ({ url: '/api/admin/products', method: 'GET', params }),
      transformResponse: envelope,
      providesTags: [{ type: 'Product', id: 'ADMIN_LIST' }],
    }),
    // single piece for the admin edit page - any state, incl. hidden/inactive products;
    // keyed by slug so an edit save (below) invalidates the load for the next visit
    adminGetProduct: build.query({
      query: (slug) => ({ url: `/api/admin/products/${encodeURIComponent(slug)}`, method: 'GET' }),
      transformResponse: (res) => res.data.product,
      providesTags: (product) => [{ type: 'Product', id: product?.slug }],
    }),
    // multipart image upload (FormData). Accepts one or many files under "images";
    // the server stores them in Cloudinary concurrently and answers { images: [...] }.
    // The longer timeout covers slow uplinks sending a full gallery in one request.
    adminUploadImage: build.mutation({
      query: (formData) => ({ url: '/api/products/admin/uploads', method: 'POST', data: formData, timeout: 120_000 }),
      transformResponse: envelope,
    }),
    adminCreateProduct: build.mutation({
      query: (body) => ({ url: '/api/admin/products', method: 'POST', data: body }),
      transformResponse: envelope,
      invalidatesTags: [{ type: 'Product', id: 'ADMIN_LIST' }, { type: 'Product', id: 'LIST' }, { type: 'Categories', id: 'LIST' }],
    }),
    adminUpdateProduct: build.mutation({
      query: ({ slug, ...body }) => ({ url: `/api/admin/products/${encodeURIComponent(slug)}`, method: 'PATCH', data: body }),
      transformResponse: envelope,
      invalidatesTags: (result, error, arg) => [
        { type: 'Product', id: 'ADMIN_LIST' },
        { type: 'Product', id: 'LIST' },
        { type: 'Product', id: arg.slug }, // keyed like adminGetProduct so a save refetches it
        { type: 'Categories', id: 'LIST' },
      ],
    }),
    adminRemoveProduct: build.mutation({
      query: (slug) => ({ url: `/api/admin/products/${encodeURIComponent(slug)}`, method: 'DELETE' }),
      transformResponse: envelope,
      invalidatesTags: [{ type: 'Product', id: 'ADMIN_LIST' }, { type: 'Product', id: 'LIST' }, { type: 'Featured', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useLazyGetProductQuery,
  useGetRelatedQuery,
  useGetFeaturedQuery,
  useGetCategoriesQuery,
  useLazyGetProductsQuery,
  useAdminListProductsQuery,
  useAdminGetProductQuery,
  useAdminUploadImageMutation,
  useAdminCreateProductMutation,
  useAdminUpdateProductMutation,
  useAdminRemoveProductMutation,
} = productsApi;

export default productsApi;


