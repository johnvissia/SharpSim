async function testData() {
  try {
    const res = await fetch('http://localhost:9002/api/accuracy-data');
    const data = await res.json();
    console.log('Total predictions returned:', data.predictions ? data.predictions.length : 0);
    console.log('Sample predictions:', JSON.stringify(data.predictions, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}
testData();
