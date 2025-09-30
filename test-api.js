// Simple test script to test the reports API
const testData = {
  message: "Test report submission",
  category: "harassment",
  severity: "medium"
};

console.log("Testing API endpoint: http://localhost:8083/api/reports");
console.log("Request data:", JSON.stringify(testData, null, 2));

fetch("http://localhost:8083/api/reports", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(testData),
})
.then(response => {
  console.log("Response status:", response.status);
  console.log("Response headers:", response.headers);
  return response.json();
})
.then(data => {
  console.log("Response data:", JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error("Error:", error);
});