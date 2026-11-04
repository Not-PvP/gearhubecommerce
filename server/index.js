require("dotenv").config();
const express = require("express");
const cors = require("cors");

const {
  XENDIT_SECRET_KEY,
  XENDIT_CALLBACK_VERIFICATION_TOKEN,
  PORT = 4000,
  CLIENT_ORIGIN = "http://localhost:3000",
} = process.env;

if (!XENDIT_SECRET_KEY) {
  console.warn(
    "[gearhub-server] XENDIT_SECRET_KEY is not set. Invoice creation will fail until it is.",
  );
}

const XENDIT_INVOICES_URL = "https://api.xendit.co/v2/invoices";

function authHeader() {
  return `Basic ${Buffer.from(`${XENDIT_SECRET_KEY}:`).toString("base64")}`;
}

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.post("/api/invoices", async (req, res) => {
  try { // basahun ya to ang invoice items kag ang reference number, check kung ara sila kag calculate ya dayun 
    const { lineItems, referenceNumber } = req.body || {};

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "lineItems is required" });
    }
    if (!referenceNumber) {
      return res.status(400).json({ error: "referenceNumber is required" });
    }

    const amount = lineItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    // send ya ang invoice sa Xendit, pati ang amount, currency kag ang details
    const response = await fetch(XENDIT_INVOICES_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: referenceNumber,
        amount,
        currency: "PHP",
        items: lineItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          category: "GEARHUB",
        })),
        success_redirect_url: `${CLIENT_ORIGIN}/?xendit=return`,
        failure_redirect_url: `${CLIENT_ORIGIN}/?xendit=return`,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      console.error("[gearhub-server] Xendit error:", json);
      return res.status(response.status).json({
        error: json?.message || json?.error_code || "Xendit request failed",
      });
    }

    console.log("[gearhub-server] Invoice", json.id, "enabled by Xendit:", {
      ewallets: (json.available_ewallets || []).map((c) => c.ewallet_type),
      banks: (json.available_banks || []).map((c) => c.bank_code),
      retail: (json.available_retail_outlets || []).map((c) => c.retail_outlet_name),
      directDebits: (json.available_direct_debits || []).map((c) => c.direct_debit_type),
      paylaters: (json.available_paylaters || []).map((c) => c.paylater_type),
      qr: (json.available_qr_codes || []).map((c) => c.qr_code_type),
      cards: json.should_exclude_credit_card ? "excluded" : "allowed",
    });

    // balik ka ang invoice id ka Xendit kag payment URL sa frontend
    res.json({ id: json.id, invoiceUrl: json.invoice_url });
  } catch (err) {
    console.error("[gearhub-server] Failed to create invoice:", err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

// Gets the invoice status from Xendit and returns it to the frontend.
app.get("/api/invoices/:id", async (req, res) => {
  try {
    const response = await fetch(`${XENDIT_INVOICES_URL}/${req.params.id}`, {
      headers: { Authorization: authHeader() },
    });
    const json = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: json?.message || json?.error_code || "Xendit request failed",
      });
    }

    res.json({ status: json.status, amount: json.amount, externalId: json.external_id });
  } catch (err) {
    console.error("[gearhub-server] Failed to retrieve invoice:", err);
    res.status(500).json({ error: "Failed to retrieve invoice" });
  }
});

app.post("/webhooks/xendit", (req, res) => {
  try {
    if (XENDIT_CALLBACK_VERIFICATION_TOKEN) { // checks the notif kung ga contain matching token kung hindi reject siya ka server
      const providedToken = req.headers["x-callback-token"];
      if (providedToken !== XENDIT_CALLBACK_VERIFICATION_TOKEN) {
        console.warn("[gearhub-server] Rejected webhook: token mismatch");
        return res.sendStatus(401);
      }
    }

    console.log( // logs the invoice status and reference id
      "[gearhub-server] Xendit webhook received:",
      req.body?.status,
      req.body?.external_id,
    );
  } catch (err) {
    console.error("[gearhub-server] Failed to process webhook:", err);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => { // starts the payment server
  console.log(`[gearhub-server] listening on http://localhost:${PORT}`);
});