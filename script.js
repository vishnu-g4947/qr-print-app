const copiesInput = document.getElementById("copies");
const totalSpan = document.getElementById("total");

const colorOptions = document.getElementsByName("color");
const sideOptions = document.getElementsByName("side");

function calculateTotal() {
  let pricePerPage = 2;

  for (let opt of colorOptions) {
    if (opt.checked && opt.value === "color") {
      pricePerPage = 5;
    }
  }

  let multiplier = 1;
  for (let opt of sideOptions) {
    if (opt.checked && opt.value === "double") {
      multiplier = 0.7; // both-sided discount
    }
  }

  const copies = Number(copiesInput.value);
  const total = Math.ceil(pricePerPage * multiplier * copies);

  totalSpan.innerText = total;
}

copiesInput.addEventListener("input", calculateTotal);
colorOptions.forEach(opt => opt.addEventListener("change", calculateTotal));
sideOptions.forEach(opt => opt.addEventListener("change", calculateTotal));

calculateTotal();
