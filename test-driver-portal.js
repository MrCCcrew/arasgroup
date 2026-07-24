// Driver Portal MVP Integration Test
const BASE_URL = 'http://localhost:3000';

async function test() {
  console.log('🧪 Starting Driver Portal Integration Test\n');

  // Test 1: Create Driver Account via API
  console.log('1️⃣ Creating driver account...');
  const createAccountRes = await fetch(`${BASE_URL}/api/driver-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: 'test_delivery_001',
      employeeId: 'test_emp_delivery_001',
      email: 'driver.test@example.com',
      password: 'TestPass123!',
      mustChangePassword: false
    })
  });

  console.log(`   Status: ${createAccountRes.status}`);
  const createData = await createAccountRes.json();
  console.log(`   Result:`, createData);

  // Test 2: Login as driver
  console.log('\n2️⃣ Logging in as driver...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'driver.test@example.com',
      password: 'TestPass123!'
    })
  });

  console.log(`   Status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  console.log(`   Success:`, loginData.success);

  const cookie = loginRes.headers.get('set-cookie');
  console.log(`   Cookie received:`, !!cookie);

  // Test 3: Access driver portal
  console.log('\n3️⃣ Accessing /driver...');
  const driverPageRes = await fetch(`${BASE_URL}/driver`, {
    headers: { 'Cookie': cookie }
  });
  console.log(`   Status: ${driverPageRes.status}`);

  // Test 4: Try accessing dashboard (should be denied)
  console.log('\n4️⃣ Accessing /dashboard (should redirect)...');
  const dashboardRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: { 'Cookie': cookie },
    redirect: 'manual'
  });
  console.log(`   Status: ${dashboardRes.status}`);
  console.log(`   Redirected:`, dashboardRes.status === 307 || dashboardRes.status === 302);

  // Test 5: Get invoices
  console.log('\n5️⃣ Getting driver invoices...');
  const invoicesRes = await fetch(`${BASE_URL}/api/driver/invoices`, {
    headers: { 'Cookie': cookie }
  });
  console.log(`   Status: ${invoicesRes.status}`);
  const invoicesData = await invoicesRes.json();
  console.log(`   Count:`, invoicesData.data?.length || 0);

  // Test 6: Start GPS session
  console.log('\n6️⃣ Starting GPS tracking session...');
  const sessionRes = await fetch(`${BASE_URL}/api/driver/tracking/session/start`, {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      deviceInfo: 'Test Device'
    })
  });
  console.log(`   Status: ${sessionRes.status}`);
  const sessionData = await sessionRes.json();
  console.log(`   Session ID:`, sessionData.data?.id?.substring(0, 10) + '...');

  // Test 7: Send GPS location
  if (sessionData.success && sessionData.data?.id) {
    console.log('\n7️⃣ Sending GPS location...');
    const locationRes = await fetch(`${BASE_URL}/api/driver/tracking/location`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionData.data.id,
        locations: [{
          clientGeneratedId: `test-${Date.now()}`,
          latitude: 29.3759,
          longitude: 47.9774,
          accuracy: 10,
          recordedAt: new Date().toISOString()
        }]
      })
    });
    console.log(`   Status: ${locationRes.status}`);
    const locationData = await locationRes.json();
    console.log(`   Saved:`, locationData.data?.saved);

    // Test 8: Send batch > 50 (should fail)
    console.log('\n8️⃣ Testing batch limit (51 points, should fail)...');
    const largeBatch = Array(51).fill(null).map((_, i) => ({
      clientGeneratedId: `test-batch-${Date.now()}-${i}`,
      latitude: 29.3759 + (i * 0.001),
      longitude: 47.9774 + (i * 0.001),
      accuracy: 10,
      recordedAt: new Date().toISOString()
    }));

    const largeBatchRes = await fetch(`${BASE_URL}/api/driver/tracking/location`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionData.data.id,
        locations: largeBatch
      })
    });
    console.log(`   Status: ${largeBatchRes.status} (expected 400)`);

    // Test 9: Send future timestamp (should fail)
    console.log('\n9️⃣ Testing future timestamp (should fail)...');
    const futureDate = new Date(Date.now() + 120000); // 2 min in future
    const futureLocationRes = await fetch(`${BASE_URL}/api/driver/tracking/location`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionData.data.id,
        locations: [{
          clientGeneratedId: `test-future-${Date.now()}`,
          latitude: 29.3759,
          longitude: 47.9774,
          accuracy: 10,
          recordedAt: futureDate.toISOString()
        }]
      })
    });
    console.log(`   Status: ${futureLocationRes.status} (expected 500)`);

    // Test 10: End session
    console.log('\n🔟 Ending GPS session...');
    const endSessionRes = await fetch(`${BASE_URL}/api/driver/tracking/session/end`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionData.data.id
      })
    });
    console.log(`   Status: ${endSessionRes.status}`);
  }

  console.log('\n✅ Test completed!');
}

test().catch(console.error);
