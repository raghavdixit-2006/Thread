// services/ordersApi.js - order placement (COD / Razorpay), listing, detail, cancel (+ admin reads).
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';
import { cartApi } from './cartApi.js';

const envelope = (res) => res.data;

export const ordersApi = createApi({
  reducerPath: 'ordersApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Order', 'Orders'],
  endpoints: (build) => ({
    placeOrder: build.mutation({
      query: (body) => ({ url: '/api/orders', method: 'POST', data: body }),
      transformResponse: envelope,
      // placement empties the server cart + earns coupons; refresh those caches directly
      // (cross-API tag invalidation is not automatic in RTK Query)
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(cartApi.util.invalidateTags(['Cart']));
        } catch {
          // failed placement keeps the cart untouched
        }
      },
      invalidatesTags: (result) => [{ type: 'Orders', id: 'MINE' }],
    }),
    listMyOrders: build.query({
      query: (params = {}) => ({ url: '/api/orders', method: 'GET', params }),
      transformResponse: envelope,
      providesTags: [{ type: 'Orders', id: 'MINE' }],
    }),
    getMyOrder: build.query({
      query: (id) => ({ url: `/api/orders/${id}`, method: 'GET' }),
      transformResponse: envelope,
      providesTags: (order) => [{ type: 'Order', id: order?._id || order?.orderNumber }],
    }),
    cancelOrder: build.mutation({
      query: ({ id, reason }) => ({ url: `/api/orders/${id}/cancel`, method: 'POST', data: { reason } }),
      transformResponse: envelope,
      invalidatesTags: (result, error, arg) => [{ type: 'Order', id: arg.id }, { type: 'Orders', id: 'MINE' }, { type: 'Cart' }],
    }),

    // payments (Razorpay): open a gateway session for a parked order, then verify the checkout
    // callback server-side - the browser only ever receives the public key id + gateway order id
    createRazorpaySession: build.mutation({
      query: (body) => ({ url: '/api/payments/razorpay/orders', method: 'POST', data: body }),
      transformResponse: envelope,
    }),
    verifyRazorpayPayment: build.mutation({
      query: (body) => ({ url: '/api/payments/razorpay/verify', method: 'POST', data: body }),
      transformResponse: envelope,
      // a verified payment advances created -> confirmed; refresh the detail view + the list
      invalidatesTags: (result, error, arg) => [{ type: 'Order', id: arg.orderId }, { type: 'Orders', id: 'MINE' }],
    }),

    // admin (phase-2 screens consume these; kept wired for the API contract)
    adminListOrders: build.query({
      query: (params = {}) => ({ url: '/api/admin/orders', method: 'GET', params }),
      transformResponse: envelope,
      providesTags: [{ type: 'Orders', id: 'ADMIN' }],
    }),
    adminGetOrder: build.query({
      query: (id) => ({ url: `/api/admin/orders/${id}`, method: 'GET' }),
      transformResponse: envelope,
      providesTags: (result, error, id) => [{ type: 'Order', id: `admin:${id}` }],
    }),
    adminSetStatus: build.mutation({
      query: ({ id, status, note }) => ({ url: `/api/admin/orders/${id}/status`, method: 'PATCH', data: { status, note } }),
      transformResponse: envelope,
      invalidatesTags: (result, error, arg) => [{ type: 'Order', id: `admin:${arg.id}` }, { type: 'Orders', id: 'ADMIN' }, { type: 'Orders', id: 'MINE' }],
    }),
    salesReport: build.query({
      query: () => ({ url: '/api/admin/orders/reports/sales', method: 'GET' }),
      transformResponse: envelope,
      providesTags: [{ type: 'Orders', id: 'REPORT' }],
    }),
  }),
});

export const {
  usePlaceOrderMutation,
  useCreateRazorpaySessionMutation,
  useVerifyRazorpayPaymentMutation,
  useListMyOrdersQuery,
  useGetMyOrderQuery,
  useCancelOrderMutation,
  useAdminListOrdersQuery,
  useAdminGetOrderQuery,
  useAdminSetStatusMutation,
  useSalesReportQuery,
} = ordersApi;

export default ordersApi;
