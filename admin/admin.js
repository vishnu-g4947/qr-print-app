async function loadData() {
  const res = await fetch("http://localhost:5050/admin/transactions");
  const data = await res.json();

  document.getElementById("count").innerText =
    "Total Transactions: " + data.count;

  const body = document.getElementById("tableBody");
  body.innerHTML = "";

  data.transactions.forEach(t => {
    const statusClass = 
      t.status === "completed" ? "status-completed" :
      t.status === "pending" ? "status-pending" :
      "status-failed";
    
    body.innerHTML += `
      <tr>
        <td><strong>#${t.id.slice(-8)}</strong></td>
        <td><strong>₹${t.amount}</strong></td>
        <td>${t.copies}</td>
        <td>${t.color === 'bw' ? 'B&W' : 'Color'}</td>
        <td>${t.side === 'single' ? 'Single' : 'Double'}</td>
        <td><span class="status-badge ${statusClass}">${t.status}</span></td>
        <td>${new Date(t.createdAt).toLocaleString()}</td>
      </tr>
    `;
  });
}

loadData();
setInterval(loadData, 5000);