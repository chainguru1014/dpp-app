// Simple HTTP server to serve the public product web page
// Run with: node server.js
// Access at: http://localhost:3000/product/{encryptedKey}

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Prefer provider-injected PORT; default to 3002 so it won't conflict with frontend (3000) or app web dev (3001).
const PORT = parseInt(process.env.PORT, 10) || 3002;
const HTML_FILE = path.join(__dirname, 'public', 'product.html');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve the product.html file for /product/:key routes
    if (pathname.startsWith('/product/')) {
        fs.readFile(HTML_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading product page');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (pathname === '/' || pathname === '/index.html') {
        // Serve a simple index page with instructions
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Product Web Server</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #1976d2; }
                    .info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h1>Product Web Server</h1>
                <div class="info">
                    <h2>Server is running!</h2>
                    <p>To view a product, use the following URL format:</p>
                    <p><code>http://localhost:${PORT}/product/{encryptedKey}</code></p>
                    <p><strong>Example:</strong></p>
                    <p><code>http://localhost:${PORT}/product/YOUR_ENCRYPTED_KEY_HERE</code></p>
                    <hr>
                    <h3>How to get an encrypted key:</h3>
                    <ol>
                        <li>Go to the admin frontend panel</li>
                        <li>Select a product and generate QR codes</li>
                        <li>Click "Generate Web QR code"</li>
                        <li>Copy one of the encrypted keys from the displayed QR codes</li>
                        <li>Use it in the URL above</li>
                    </ol>
                </div>
            </body>
            </html>
        `);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n✅ Product Web Server is running!`);
    console.log(`📍 Server URL: http://localhost:${PORT}`);
    console.log(`📄 Product page: http://localhost:${PORT}/product/{encryptedKey}`);
    console.log(`\n💡 To test, you need an encrypted key from a generated QR code.\n`);
});
