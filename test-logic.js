import axios from 'axios';

async function testFrontendLogic() {
  try {
    // We hit the exact local API the frontend hits
    const res = await axios.get('http://localhost:5000/api/v1/shipmaxx/ndr');
    
    // Exact frontend extraction logic
    const d1 = res.data;
    const d2 = d1?.data;
    const d3 = d2?.data;

    let arr = [];
    if (Array.isArray(d3)) arr = d3;
    else if (Array.isArray(d2)) arr = d2;
    else if (Array.isArray(d1)) arr = d1;

    console.log(`Extracted Array Length: ${arr.length}`);
    if (arr.length > 0) {
      console.log('First extracted item:', Object.keys(arr[0]));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testFrontendLogic();
