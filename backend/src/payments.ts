import { HttpError } from './errors';

// asks our payment server (it holds the Xendit secret key) if an invoice is really paid
const PAYMENT_SERVER_URL = () => process.env.PAYMENT_SERVER_URL || 'http://localhost:4000';

const PAID_STATUSES = ['PAID', 'SETTLED'];

interface InvoiceInfo {
  status?: string;
  amount?: number;
}

export const verifyXenditPayment = async (invoiceId: string, expectedTotal: number) => {
  let invoice: InvoiceInfo;
  try {
    const response = await fetch(`${PAYMENT_SERVER_URL()}/api/invoices/${encodeURIComponent(invoiceId)}`);
    if (response.status === 404) {
      throw new HttpError(400, 'Payment not found.');
    }
    if (!response.ok) {
      throw new HttpError(502, "Couldn't confirm the payment with the payment server.");
    }
    invoice = (await response.json()) as InvoiceInfo;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "Couldn't reach the payment server to confirm the payment.");
  }

  if (!invoice.status || !PAID_STATUSES.includes(invoice.status)) {
    throw new HttpError(402, 'Payment has not been completed.');
  }

  if (Math.round(Number(invoice.amount) * 100) !== Math.round(expectedTotal * 100)) {
    throw new HttpError(400, "The amount paid doesn't match the order total.");
  }
};
