async function test() {
  try {
    const url1 = 'http://127.0.0.1:4173/api/inspirations?userId=local_test';
    console.log(`Fetching ${url1}...`);
    const res1 = await fetch(url1);
    console.log('HTTP Status 1:', res1.status);
    const data1 = await res1.json();
    console.log('Response ok 1:', data1.ok);
    console.log('Inspirations Count:', data1.inspirations?.length);

    const url2 = 'http://127.0.0.1:4173/api/knowledge/list?userId=local_test';
    console.log(`Fetching ${url2}...`);
    const res2 = await fetch(url2);
    console.log('HTTP Status 2:', res2.status);
    const data2 = await res2.json();
    console.log('Response ok 2:', data2.ok);
    console.log('Knowledge Count:', data2.list?.length);
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

test();
