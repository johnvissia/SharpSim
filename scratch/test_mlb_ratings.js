async function test() {
  try {
    const res = await fetch('http://localhost:9002/api/calculate-mlb-ratings', { method: 'POST' });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('RESPONSE:', text);
  } catch (err) {
    console.error('FETCH ERROR:', err);
  }
}
test();
