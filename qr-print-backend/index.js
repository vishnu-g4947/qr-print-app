import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const transactions = [];

app.post("/create-order", async (req, res) => {
  const order = await razorpay.orders.create({
    amount: req.body.amount * 100,
    currency: "INR",
    receipt: `print_${Date.now()}`
  });
  res.json({ order });
});

app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, jobData } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return res.json({ success: false });
  }

  transactions.push({
    id: "TXN_" + Date.now(),
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    amount: jobData.amount,
    copies: jobData.copies,
    color: jobData.color,
    side: jobData.side,
    status: "PAID",
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});

app.get("/admin/transactions", (req, res) => {
  res.json({
    count: transactions.length,
    transactions
  });
});

app.listen(5050, () => {
  console.log("Backend running on port 5050");
});