// utils/razorpay.js - Razorpay checkout widget plumbing: lazy script loader + the open/verify flow.
// checkout.js is a public widget; the key id and the gateway order id arrive from the API at
// call time, so nothing sensitive is ever embedded in the client bundle.

let loaderPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Could not load the payment widget - check the network and try again'));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/**
 * Opens the Razorpay modal for a parked order and resolves once the widget reports a final
 * state. The server verifies every outcome by signature; 'paid' is only resolved on a verified
 * payment, while dismiss/failure leave the order parked for a retry or cancel on its detail page.
 *
 * deps: { order, user, contact, createSession, verifyPayment } - RTK mutation hooks
 * resolves { status: 'paid' | 'dismissed' | 'unverified', error? }
 */
export async function payWithRazorpay({ order, user, contact, createSession, verifyPayment }) {
  // gateway-session failures surface here: 503 unconfigured, 409 already paid, network down
  const session = await createSession({ orderId: String(order._id) }).unwrap();
  await loadRazorpayScript();

  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amount,
      currency: session.currency,
      name: 'THREAD',
      description: `Order ${order.orderNumber || String(order._id)}`,
      notes: { threadOrder: order.orderNumber || String(order._id) },
      prefill: { name: user?.name || '', email: user?.email || '', contact: contact || '' },
      theme: { color: '#171410' },
      handler: (response) => {
        verifyPayment({
          orderId: session.orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        })
          .unwrap()
          .then(() => resolve({ status: 'paid' }))
          .catch((error) => resolve({ status: 'unverified', error })); // server envelope, order stays parked
      },
      modal: {
        // a stray backdrop click should not throw away a half-filled card form
        confirm_close: true,
        ondismiss: () => resolve({ status: 'dismissed' }),
      },
    });
    // card/UPI failures arrive here before the widget closes; the order stays parked for a retry
    rzp.on('payment.failed', (response) => {
      resolve({
        status: 'unverified',
        error: {
          message: response?.error?.description || 'The payment failed at the gateway. Nothing was charged.',
          details: response?.error?.reason ? [{ field: 'payment', issue: response.error.reason }] : null,
        },
      });
    });
    rzp.open();
  });
}
