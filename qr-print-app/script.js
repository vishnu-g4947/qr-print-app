const copiesInput = document.getElementById("copies");
const totalSpan = document.getElementById("total");
const fileInput = document.getElementById("file");
const payBtn = document.getElementById("payBtn");
const statusText = document.getElementById("status");

function calculateTotal() {
  const color = document.querySelector("input[name='color']:checked").value;
  const side = document.querySelector("input[name='side']:checked").value;

  let price = color === "color" ? 5 : 2;
  let multiplier = side === "double" ? 0.7 : 1;

  let copies = Number(copiesInput.value);
  let total = Math.ceil(price * multiplier * copies);

  totalSpan.innerText = total;
}

document.querySelectorAll("input").forEach(el => {
  el.addEventListener("change", calculateTotal);
});

calculateTotal();

payBtn.onclick = async () => {
  statusText.innerText = "";

  if (!fileInput.files.length) {
    statusText.innerText = "Upload a document";
    return;
  }

  let amount = Number(totalSpan.innerText);
  payBtn.disabled = true;
  statusText.innerText = "Creating order...";

  try {
    const orderRes = await fetch("http://localhost:5050/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });

    if (!orderRes.ok) throw new Error();

    const orderData = await orderRes.json();

    const options = {
      key: "rzp_live_SAtWYv5Zg03LXG",
      amount: orderData.order.amount,
      currency: "INR",
      name: "PrintMitra",
      order_id: orderData.order.id,

      handler: async function (response) {
        const verifyRes = await fetch("http://localhost:5050/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            jobData: {
              amount: amount,
              copies: copiesInput.value,
              color: document.querySelector("input[name='color']:checked").value,
              side: document.querySelector("input[name='side']:checked").value
            }
          })
        });

        const result = await verifyRes.json();

        if (result.success) {
          statusText.innerText = "Payment Successful";
        } else {
          statusText.innerText = "Verification Failed";
        }

        payBtn.disabled = false;
      }
    };

    new Razorpay(options).open();

  } catch {
    statusText.innerText = "Payment Failed";
    payBtn.disabled = false;
  }
};