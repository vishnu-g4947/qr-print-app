require("dotenv").config();
const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const Razorpay = require("razorpay");
const path = require("path");

const app = express();
const cors = require("cors");
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.status(200).send("PrintATM backend is running 🚀");
});

const upload = multer({ dest: "uploads/" });

let jobs = [];

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ==============================
// MULTI FILE UPLOAD
// ==============================
app.post("/upload", upload.array("files"), async (req, res) => {
  let totalPages = 0;

  for (const file of req.files) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.mimetype === "application/pdf") {
      const data = fs.readFileSync(file.path);
      const pdf = await pdfParse(data);
      totalPages += pdf.numpages;
    }
    else if (file.mimetype.startsWith("image/")) {
      totalPages += 1;
    }
    else {
      totalPages += 1; // estimated
    }
  }

  const rate = req.body.color === "color" ? 5 : 2;
  const copies = Number(req.body.copies);
  const cost = totalPages * rate * copies;

  const job = {
    id: Date.now(),
    files: req.files.map(f => f.originalname),
    paths: req.files.map(f => f.path),
    pages: totalPages,
    copies,
    color: req.body.color,
    cost,
    status: "PENDING"
  };

  jobs.push(job);
  res.json(job);
});

// ==============================
// PAYMENT
// ==============================
app.post("/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: req.body.amount * 100,
      currency: "INR"
    });
    res.json(order);
  } catch (err) {
    console.error("Razorpay error:", err);
    res.status(500).json({ error: "Payment order failed" });
  }
});

app.post("/verify-payment/:id", (req, res) => {
  if (!req.params.id) {
    return res.status(400).json({ error: "Invalid job ID" });
  }
  const job = jobs.find(j => j.id == req.params.id);
  job.status = "PAID";
  res.json({ success: true });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});
// ==============================
// ADMIN
// ==============================
app.get("/jobs", (req, res) => {
  res.json(jobs);
});

app.post("/print/:id", (req, res) => {
  const job = jobs.find(j => j.id == req.params.id);
  job.status = "PRINTED";

  job.paths.forEach(p => fs.unlink(p, () => {}));
  res.json({ success: true });
});


app.listen(PORT, () => {
  console.log("=================================");
  console.log("🚀 PrintATM Backend Started");
  console.log("Listening on PORT:", PORT);
  console.log("=================================");
});