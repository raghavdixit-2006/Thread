// routes/index.js - central API route registry (single mounting point).
import { Router } from 'express';
import { health } from './healthController.js';
import { storefrontConfig } from './configController.js';
import { authRoutes } from '../modules/auth/routes.js';
import { productRoutes } from '../modules/products/routes.js';
import { cartRoutes } from '../modules/carts/cartsController.js';
import { wishlistRoutes } from '../modules/wishlists/wishlistModule.js';
import { orderRoutes, orderAdminRoutes } from '../modules/orders/ordersController.js';
import { couponRoutes } from '../modules/coupons/couponsModule.js';
import { reviewRoutes } from '../modules/reviews/reviewsModule.js';
import { userRoutes } from '../modules/users/usersModule.js';
import { policyRoutes, policyAdminRoutes } from '../modules/policies/policiesModule.js';
import { adminRoutes, adminAuthRoutes } from '../modules/admin/adminModule.js';
import { paymentRoutes } from '../modules/payments/paymentsModule.js';

export function apiRoutes() {
  const router = Router();

  router.get('/health', health);
  router.get('/config', storefrontConfig); // public capabilities: payment methods, nothing secret

  router.use('/auth', authRoutes());
  router.use('/products', productRoutes());
  router.use('/cart', cartRoutes());
  router.use('/payments', paymentRoutes()); // gateway order create + verify; the raw webhook mounts earlier in createApp
  router.use('/wishlist', wishlistRoutes());
  router.use('/orders', orderRoutes());
  router.use('/coupons', couponRoutes());
  router.use('/reviews', reviewRoutes());
  router.use('/users', userRoutes());
  router.use('/policies', policyRoutes());

  // admin namespace - the public staff login mounts BEFORE the RBAC-gated router
  // (Express falls through unmatched requests from the first to the second)
  router.use('/admin/orders', orderAdminRoutes());
  router.use('/admin/policies', policyAdminRoutes());
  router.use('/admin', adminAuthRoutes());
  router.use('/admin', adminRoutes());

  return router;
}
