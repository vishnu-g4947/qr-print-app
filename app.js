const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const settings = document.getElementById('settings');
const pageCountSpan = document.getElementById('pageCount');
const totalPriceSpan = document.getElementById('totalPrice');
const colorMode = document.getElementById('colorMode');

let totalPages = 0;

// Trigger file input
dropzone.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            totalPages = pdf.numPages;
            
            // Show settings and update UI
            settings.classList.remove('hidden');
            pageCountSpan.innerText = totalPages;
            updatePrice();
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert("Please upload a valid PDF file.");
    }
};

const updatePrice = () => {
    const rate = parseInt(colorMode.value);
    totalPriceSpan.innerText = totalPages * rate;
};

colorMode.onchange = updatePrice;

// Razorpay Integration
document.getElementById('payButton').onclick = async () => {
    const amount = parseInt(totalPriceSpan.innerText);
    
    if (amount <= 0) {
        alert("Please upload a file first!");
        return;
    }

    const options = {
        "key": "rzp_live_SAx3aXkZgPomZ2", // Paste your rzp_test_... key here
        "amount": amount * 100, 
        "currency": "INR",
        "name": "PrintMitra",
        "description": `Print Job: ${totalPages} pages`,
        "image": "https://print-atm.vercel.app/logo.png", // Use your logo if you have one
        "handler": function (response) {
            // This runs ONLY if payment succeeds
            processPrintJob(response.razorpay_payment_id);
        },
        "prefill": {
            "name": "Customer",
            "contact": "9999999999"
        },
        "theme": {
            "color": "#2563eb"
        }
    };

    const rzp1 = new Razorpay(options);
    rzp1.open();
};

function processPrintJob(paymentId) {
    // 1. UI Update
    document.body.innerHTML = 
        <div class="max-w-md mx-auto min-h-screen p-6 flex flex-col items-center justify-center text-center">
            <div class="text-green-500 text-6xl mb-4">✔</div>
            <h1 class="text-2xl font-bold">Payment Successful!</h1>
            <p class="text-gray-500 mt-2">Transaction ID: ${paymentId}</p>
            <div class="mt-8 p-4 bg-blue-50 rounded-lg animate-pulse">
                <p class="text-blue-700 font-medium">Sending document to Printer...</p>
            </div>
            <p class="mt-4 text-sm text-gray-400">Please do not close this window until printing starts.</p>
        </div>
    ;

    // 2. Arduino/IoT Trigger (Logic for later)
    console.log("Triggering Hardware for Payment:", paymentId);
    // TODO: fetch('/api/trigger-printer', { method: 'POST', body: { paymentId } });
}