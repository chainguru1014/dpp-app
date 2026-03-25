// Script to get a sample encrypted key from the backend
// This helps you get a test key to access the product web page
// Run with: node get-sample-key.js

const axios = require('axios');

const BACKEND_URL = 'http://localhost:5052/';

async function getSampleKey() {
    try {
        console.log('🔍 Fetching products from backend...\n');
        
        // Get all products
        const productsResponse = await axios.get(`${BACKEND_URL}product/`);
        const products = productsResponse.data.data?.data || productsResponse.data.data || [];
        
        if (products.length === 0) {
            console.log('❌ No products found. Please create a product first in the admin panel.\n');
            return;
        }
        
        const product = products[0];
        console.log(`✅ Found product: ${product.name || product._id}\n`);
        
        // Get QR codes for this product
        console.log('🔍 Fetching QR codes for this product...\n');
        const qrResponse = await axios.post(`${BACKEND_URL}qrcode/product`, {
            product_id: product._id,
            page: 1
        });
        
        const qrCodes = qrResponse.data.data || [];
        
        if (qrCodes.length === 0) {
            console.log('❌ No QR codes found for this product.');
            console.log('💡 Please generate QR codes in the admin panel first.\n');
            return;
        }
        
        const encryptedKey = qrCodes[0];
        
        console.log('✅ Sample Encrypted Key Found!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Encrypted Key:');
        console.log(encryptedKey);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🌐 Test URLs:\n');
        console.log(`   Backend Server:`);
        console.log(`   http://localhost:5052/product/${encodeURIComponent(encryptedKey)}\n`);
        console.log(`   Web Server (port 3000):`);
        console.log(`   http://localhost:3000/product/${encodeURIComponent(encryptedKey)}\n`);
        console.log('💡 Copy one of these URLs and open it in your browser!\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        console.log('\n💡 Make sure:');
        console.log('   1. Backend server is running on http://localhost:5052');
        console.log('   2. MongoDB is connected');
        console.log('   3. You have at least one product with QR codes\n');
    }
}

getSampleKey();
