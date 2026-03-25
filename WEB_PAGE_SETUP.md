# Public Web Page Setup Guide

## Quick Start

### Option 1: Using Backend Server (Recommended)

The backend already serves the web page at `/product/:key`. Just start your backend server:

```bash
cd backend
npm start
```

Then access the page at:
```
http://localhost:5052/product/{encryptedKey}
```

### Option 2: Using Standalone Web Server

1. **Start the web server:**
   ```bash
   cd app
   npm run serve:web
   ```

2. **Access the page at:**
   ```
   http://localhost:3000/product/{encryptedKey}
   ```

## Getting a Sample Encrypted Key

### Method 1: Using the Script (Easiest)

```bash
cd app
npm run get:key
```

This will:
- Connect to your backend
- Find the first product with QR codes
- Display a sample encrypted key
- Show you the test URLs

### Method 2: From Admin Panel

1. Open the frontend admin panel
2. Select a product
3. Generate QR codes (click "Generate QR code")
4. Click "Generate Web QR code"
5. Copy one of the encrypted keys displayed

### Method 3: From Backend API

```bash
# Get all products
curl http://localhost:5052/product/

# Get QR codes for a product (replace PRODUCT_ID)
curl -X POST http://localhost:5052/qrcode/product \
  -H "Content-Type: application/json" \
  -d '{"product_id": "YOUR_PRODUCT_ID", "page": 1}'
```

## Sample URLs

Once you have an encrypted key, use these URLs:

### Via Backend Server (Port 5052):
```
http://localhost:5052/product/YOUR_ENCRYPTED_KEY_HERE
```

### Via Web Server (Port 3000):
```
http://localhost:3000/product/YOUR_ENCRYPTED_KEY_HERE
```

## Example

If your encrypted key is: `abc123xyz789...`

**Backend URL:**
```
http://localhost:5052/product/abc123xyz789...
```

**Web Server URL:**
```
http://localhost:3000/product/abc123xyz789...
```

## Testing the Web Page

1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Get a sample key:**
   ```bash
   cd app
   npm run get:key
   ```

3. **Copy the URL shown and open it in your browser**

4. **You should see:**
   - Product name
   - Product model
   - Product description
   - Image carousel (if images exist)

## Troubleshooting

### "No products found"
- Create a product in the admin panel first
- Make sure MongoDB is connected

### "No QR codes found"
- Generate QR codes for your product in the admin panel
- Click "Generate QR code" button

### "Error loading product"
- Make sure backend is running on port 5052
- Check that the encrypted key is correct
- Verify the product exists in the database

### "Cannot connect to backend"
- Ensure backend server is running: `cd backend && npm start`
- Check MongoDB connection
- Verify port 5052 is not blocked

## Notes

- The web page automatically fetches product data from the backend API
- Images are loaded from the backend `/files/` endpoint
- The page is responsive and works on mobile and desktop
- CORS must be enabled in the backend for the web page to work
