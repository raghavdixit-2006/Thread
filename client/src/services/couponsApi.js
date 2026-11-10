// services/couponsApi.js - public coupon validation (money in paise).
// data: { valid, code, discount, reason?, ... } - reason when invalid (by contract).
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const couponsApi = createApi({
  reducerPath: 'couponsApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (build) => ({
    validateCoupon: build.mutation({
      query: ({ code, subtotal }) => ({ url: '/api/coupons/validate', method: 'POST', data: { code, subtotal } }),
      transformResponse: envelope,
    }),
  }),
});

export const { useValidateCouponMutation } = couponsApi;
export default couponsApi;
