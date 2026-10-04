const API_URL = "https://cipherchat-x8nx.onrender.com";

fetch(API_URL)
  .then(res => res.text())
  .then(data => {
    document.getElementById("status").innerText = data;
  })
  .catch(err => {
    document.getElementById("status").innerText = "Error connecting to backend.";
    console.error("Connection error:", err);
  });