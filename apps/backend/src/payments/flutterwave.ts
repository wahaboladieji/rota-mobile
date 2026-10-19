import { logger } from '../observability/logger';

export interface InitializePaymentParams {
  txRef: string;
  amountCents: number;
  currency?: string;
  customerEmail: string;
  customerName?: string;
  redirectUrl?: string;
  title?: string;
  description?: string;
  meta?: Record<string, string>;
}

export interface InitializePaymentResult {
  checkoutUrl: string;
  txRef: string;
}

export interface VerifyTransactionResult {
  success: boolean;
  status: string; // e.g. "successful", "failed"
  amount: number; // in standard unit, e.g. 20.00
  currency: string;
  txRef: string;
  flwRef: string;
  transactionId: number | string;
  customerEmail?: string;
  raw: unknown;
}

import { providerConfig, serverConfig } from '../config';

/**
 * Flutterwave Provider Adapter
 * Encapsulates all v3 API interactions behind a strongly typed, provider-agnostic interface.
 */
export class FlutterwaveAdapter {
  private static getSecretKey(): string {
    const key = providerConfig.flutterwaveSecretKey;
    if (!key) {
      throw new Error('FLUTTERWAVE_SECRET_KEY is not configured in backend environment');
    }
    return key;
  }

  private static getSecretHash(): string {
    return providerConfig.flutterwaveSecretHash;
  }

  /**
   * Initializes a standard hosted payment session with Flutterwave.
   * Converts amount in integer cents into standard decimal dollar amount for the gateway.
   */
  static async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const secretKey = this.getSecretKey();
    const currency = params.currency || 'USD';
    const amountInUnits = (params.amountCents / 100).toFixed(2);

    const payload = {
      tx_ref: params.txRef,
      amount: amountInUnits,
      currency,
      redirect_url:
        params.redirectUrl ||
        `${serverConfig.apiBaseUrl}/api/payment/callback`,
      customer: {
        email: params.customerEmail,
        name: params.customerName || 'Rota Team Owner',
      },
      customizations: {
        title: params.title || 'Rota Subscription',
        description: params.description || 'Monthly scheduling subscription',
      },
      meta: params.meta || {},
    };

    logger.info('Calling Flutterwave Standard API /v3/payments', {
      txRef: params.txRef,
      amountCents: params.amountCents,
      currency,
    });

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as {
      status: string;
      message: string;
      data?: { link: string };
    };

    if (!response.ok || json.status !== 'success' || !json.data?.link) {
      logger.error('Flutterwave payment initiation rejected', {
        status: response.status,
        message: json.message,
      });
      throw new Error(`Flutterwave payment initiation failed: ${json.message || 'Unknown provider error'}`);
    }

    return {
      checkoutUrl: json.data.link,
      txRef: params.txRef,
    };
  }

  /**
   * Re-verifies a transaction directly with Flutterwave's verification endpoint.
   * Endpoint: GET https://api.flutterwave.com/v3/transactions/:id/verify
   */
  static async verifyTransaction(transactionId: number | string): Promise<VerifyTransactionResult> {
    const secretKey = this.getSecretKey();

    logger.info('Calling Flutterwave verification API', { transactionId });

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const json = (await response.json()) as {
      status: string;
      message: string;
      data?: {
        id: number;
        tx_ref: string;
        flw_ref: string;
        amount: number;
        currency: string;
        status: string;
        customer?: { email: string };
      };
    };

    if (!response.ok || !json.data) {
      logger.warn('Flutterwave verification call returned error or empty data', {
        status: response.status,
        message: json.message,
      });
      return {
        success: false,
        status: 'FAILED',
        amount: 0,
        currency: '',
        txRef: '',
        flwRef: '',
        transactionId,
        raw: json,
      };
    }

    const isSuccessful = json.status === 'success' && json.data.status === 'successful';

    return {
      success: isSuccessful,
      status: json.data.status,
      amount: json.data.amount,
      currency: json.data.currency,
      txRef: json.data.tx_ref,
      flwRef: json.data.flw_ref,
      transactionId: json.data.id,
      customerEmail: json.data.customer?.email,
      raw: json.data,
    };
  }

  /**
   * Re-verifies a transaction directly with Flutterwave's verification by tx_ref endpoint.
   * Endpoint: GET https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=:txRef
   */
  static async verifyByTxRef(txRef: string): Promise<VerifyTransactionResult> {
    const secretKey = this.getSecretKey();

    logger.info('Calling Flutterwave verify_by_reference API', { txRef });

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const json = (await response.json()) as {
      status: string;
      message: string;
      data?: {
        id: number;
        tx_ref: string;
        flw_ref: string;
        amount: number;
        currency: string;
        status: string;
        customer?: { email: string };
      };
    };

    if (!response.ok || !json.data) {
      logger.warn('Flutterwave verify_by_reference returned error or empty data', {
        status: response.status,
        message: json.message,
      });
      return {
        success: false,
        status: 'FAILED',
        amount: 0,
        currency: '',
        txRef,
        flwRef: '',
        transactionId: 0,
        raw: json,
      };
    }

    const isSuccessful = json.status === 'success' && json.data.status === 'successful';

    return {
      success: isSuccessful,
      status: json.data.status,
      amount: json.data.amount,
      currency: json.data.currency,
      txRef: json.data.tx_ref,
      flwRef: json.data.flw_ref,
      transactionId: json.data.id,
      customerEmail: json.data.customer?.email,
      raw: json.data,
    };
  }

  /**
   * Verifies the secret hash signature on incoming webhooks (header 'verif-hash').
   */
  static verifyWebhookSignature(headerHash?: string | string[]): boolean {
    const configuredSecretHash = this.getSecretHash();
    if (!configuredSecretHash) {
      logger.error('FLUTTERWAVE_SECRET_HASH is not set; rejecting incoming webhook');
      return false;
    }
    const signature = Array.isArray(headerHash) ? headerHash[0] : headerHash;
    return signature === configuredSecretHash;
  }
}
