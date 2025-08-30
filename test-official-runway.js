
const API_KEY = 'key_a33ec5121fccdca78789ef930fb9483c43656f2cd525b4199cd763e7f6456214a1530801bed32dff7a5c08e9147d06945abaf9136c40696cb6089dfa0ea9624a';

async function testOfficialRunwayAPI() {
    console.log('🧪 Testing Official Runway API patterns...');
    
    // Try different possible endpoints and version formats
    const testCases = [
        {
            name: 'Standard v1 with current date version',
            url: 'https://api.runwayml.com/v1/tasks',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'X-Runway-Version': '2024-11-13'
            }
        },
        {
            name: 'Standard v1 with 2024-09-13 version',
            url: 'https://api.runwayml.com/v1/tasks',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'X-Runway-Version': '2024-09-13'
            }
        },
        {
            name: 'Image to video endpoint',
            url: 'https://api.runwayml.com/v1/image_to_video',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'X-Runway-Version': '2024-11-13'
            },
            method: 'POST',
            body: {
                model: 'gen3a_turbo',
                prompt_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
                prompt_text: 'test animation',
                duration: 5
            }
        },
        {
            name: 'No version header',
            url: 'https://api.runwayml.com/v1/tasks',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        },
        {
            name: 'Different auth format',
            url: 'https://api.runwayml.com/v1/tasks',
            headers: {
                'Authorization': `${API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Testing: ${testCase.name}`);
        console.log(`📡 URL: ${testCase.url}`);
        
        try {
            const options = {
                method: testCase.method || 'GET',
                headers: testCase.headers
            };
            
            if (testCase.body) {
                options.body = JSON.stringify(testCase.body);
            }
            
            const response = await fetch(testCase.url, options);
            
            console.log(`📊 Status: ${response.status} ${response.statusText}`);
            console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));
            
            const responseText = await response.text();
            console.log('📄 Response Body:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
            
            if (response.ok) {
                console.log('✅ SUCCESS! This endpoint works!');
                try {
                    const data = JSON.parse(responseText);
                    console.log('📦 Parsed Response:', data);
                } catch (e) {
                    console.log('⚠️  Response is not JSON');
                }
                break; // Stop testing once we find a working endpoint
            }
            
        } catch (error) {
            console.log(`❌ Network Error: ${error.message}`);
        }
        
        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Run the test
if (typeof window !== 'undefined') {
    // Browser environment
    console.log('🌐 Running in browser environment');
    window.testOfficialRunwayAPI = testOfficialRunwayAPI;
    testOfficialRunwayAPI();
} else if (typeof module !== 'undefined') {
    // Node.js environment
    console.log('🟢 Running in Node.js environment');
    if (typeof fetch === 'undefined') {
        console.log('⚠️  fetch not available, install node-fetch: npm install node-fetch');
    } else {
        testOfficialRunwayAPI();
    }
} 