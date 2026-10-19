import { Router, Request, Response } from 'express';
import { logger } from '../observability/logger';
import { verifyAndSettlePaymentAttempt } from '../domain/payment-settlement.service';

export const paymentCallbackRouter = Router();

/**
 * GET /api/payment/callback
 * Hosted checkout redirect target.
 * When payment finishes on Flutterwave, the user's browser is redirected here.
 * The server immediately verifies the payment against Flutterwave and returns a bridge page
 * that automatically deep-links back into the Rota mobile application.
 */
paymentCallbackRouter.get('/payment/callback', async (req: Request, res: Response) => {
  const { status, tx_ref, transaction_id } = req.query;

  const txRefStr = typeof tx_ref === 'string' ? tx_ref : '';
  const statusStr = typeof status === 'string' ? status : '';
  const transactionIdStr = typeof transaction_id === 'string' ? transaction_id : undefined;

  logger.info('Received Flutterwave payment return callback', {
    status: statusStr,
    txRef: txRefStr,
    transactionId: transactionIdStr,
  });

  let isVerified = false;

  if (statusStr === 'successful' && txRefStr) {
    try {
      const result = await verifyAndSettlePaymentAttempt({
        txRef: txRefStr,
        providerTransactionId: transactionIdStr,
        source: 'CALLBACK',
      });
      isVerified = result.status === 'VERIFIED' || result.status === 'ALREADY_VERIFIED';
    } catch (err) {
      logger.error('Error during callback payment settlement', err);
    }
  }

  const appSchemeUrl = `rota://billing/callback?status=${isVerified ? 'successful' : statusStr}&tx_ref=${encodeURIComponent(txRefStr)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isVerified ? 'Payment Verified' : 'Payment Processing'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0F172A;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background-color: #1E293B;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: ${isVerified ? '#059669' : '#D97706'};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
      color: #FFFFFF;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 10px;
    }
    p {
      color: #94A3B8;
      font-size: 15px;
      line-height: 1.5;
      margin: 0 0 28px;
    }
    .btn {
      display: block;
      background-color: #2563EB;
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      padding: 14px 20px;
      border-radius: 12px;
      transition: background-color 0.2s;
    }
    .btn:active {
      background-color: #1D4ED8;
    }
    .note {
      font-size: 12px;
      color: #64748B;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isVerified ? '✓' : 'ℹ'}</div>
    <h1>${isVerified ? 'Payment Successful!' : 'Payment Complete'}</h1>
    <p>${
      isVerified
        ? 'Your payment has been verified and your Rota subscription is now active.'
        : 'Returning to Rota to confirm your subscription status.'
    }</p>
    <a href="${appSchemeUrl}" class="btn" id="openAppBtn">Open Rota App</a>
    <div class="note">If the app doesn't open automatically, tap the button above.</div>
  </div>

  <script>
    setTimeout(function() {
      window.location.href = "${appSchemeUrl}";
    }, 800);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
