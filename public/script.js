let selectedFiles = [];
let currentJob = null;

/* =====================
   BACKEND CONFIG
===================== */
const BACKEND_URL = "https://printatm.up.railway.app";

/* =====================
   GLOBAL DRAG FIX
===================== */
["dragenter","dragover","dragleave","drop"].forEach(evt => {
  document.addEventListener(evt, e => {
    e.preventDefault();
    e.stopPropagation();
  });
});

/* =====================
   ELEMENTS
===================== */
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview-container");
const dropText = document.getElementById("drop-text");

const colorSelect = document.getElementById("color");
const copiesInput = document.getElementById("copies");
const pageCountEl = document.getElementById("pageCount");
const totalPriceEl = document.getElementById("totalPrice");

/* =====================
   FILE INPUT
===================== */
fileInput.addEventListener("click", () => {
  fileInput.value = null;
});

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files);
  renderPreviews();
  calculatePrice();
});

/* =====================
   DRAG & DROP
===================== */
dropZone.addEventListener("dragenter", () => {
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", e => {
  dropZone.classList.remove("dragover");
  selectedFiles = Array.from(e.dataTransfer.files);
  renderPreviews();
  calculatePrice();
});

/* =====================
   PREVIEW
===================== */
function renderPreviews() {
  preview.innerHTML = "";
  dropText.innerText = `${selectedFiles.length} file(s) selected`;

  selectedFiles.forEach(file => {
    const card = document.createElement("div");
    card.className = "preview-card";

    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      card.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.innerText = "PDF / FILE";
      card.appendChild(span);
    }

    preview.appendChild(card);
  });
}

/* =====================
   PRICE CALCULATOR
===================== */
function calculatePrice() {
  if (!selectedFiles.length) {
    pageCountEl.innerText = "—";
    totalPriceEl.innerText = "₹0.00";
    return;
  }

  const copies = Number(copiesInput.value) || 1;
  const color = colorSelect.value;
  const pricePerPage = color === "color" ? 5 : 2;

  const estimatedPages = selectedFiles.length;

  const total =
    estimatedPages * pricePerPage * copies;

  pageCountEl.innerText = estimatedPages;
  totalPriceEl.innerText = `₹${total.toFixed(2)}`;
}

colorSelect.addEventListener("change", calculatePrice);
copiesInput.addEventListener("input", calculatePrice);

/* =====================
   UPLOAD
===================== */
async function upload() {
  if (!selectedFiles.length) {
    alert("No files selected");
    return;
  }

  const loader = document.getElementById("loader");
  loader.classList.remove("hidden");

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append("files", f));
  formData.append("color", colorSelect.value);
  formData.append("copies", copiesInput.value);

  const res = await fetch(`${BACKEND_URL}`, {
    method: "POST",
    body: formData
  });

  currentJob = await res.json();
  loader.classList.add("hidden");

  pageCountEl.innerText = currentJob.pages;
  totalPriceEl.innerText = `₹${currentJob.cost.toFixed(2)}`;

  pay();
}

/* =====================
   PAYMENT
===================== */
async function pay() {
  if (!currentJob || currentJob.cost <= 0) return;

  const order = await fetch(`${BACKEND_URL}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: currentJob.cost })
  }).then(r => r.json());

  const rzp = new Razorpay({
    key: "rzp_live_SBYx9zBvIEWVXD",
    amount: order.amount,
    currency: "INR",
    order_id: order.id,
    name: "PrintATM",
    description: "Smart Printing Payment",
    handler: async function (response) {
      try {
        await fetch(`${BACKEND_URL}/verify-payment/${currentJob.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          })
        });

        alert("Payment successful. Print job confirmed.");
      } catch (err) {
        console.error("Payment verification failed", err);
        alert("Payment succeeded but verification failed. Contact support.");
      }
    }
  });

  rzp.open();
}