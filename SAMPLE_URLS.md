# Sample URLs for Testing Web Page

## 📍 Access Points

The public web page can be accessed through two methods:

### 1. Backend Server (Port 5052) - **Recommended**
```
http://localhost:5052/product/{encryptedKey}
```

### 2. Standalone Web Server (Port 3000)
```
http://localhost:3000/product/{encryptedKey}
```

## 🔑 How to Get an Encrypted Key

The encrypted key is generated when you create QR codes. Here's how:

### From Admin Panel:
1. Login to frontend admin panel
2. Select a product
3. Click "Generate QR code" 
4. Click "Generate Web QR code"
5. Copy one of the encrypted keys displayed

### Example Encrypted Key Format:
```
U2FsdGVkX1+abc123xyz789def456ghi012jkl345mno678pqr901stu234vwx567yz890
```

*(This is just an example - your actual key will be different and much longer)*

## 📝 Example URLs

### Example 1: Using Backend
```
http://localhost:5052/product/U2FsdGVkX1+abc123xyz789def456ghi012jkl345mno678pqr901stu234vwx567yz890
```

### Example 2: Using Web Server
```
http://localhost:3000/product/U2FsdGVkX1+abc123xyz789def456ghi012jkl345mno678pqr901stu234vwx567yz890
```

## 🎯 Quick Test Steps

1. **Ensure backend is running:**
   ```bash
   cd backend
   npm start
   ```

2. **Get a real encrypted key:**
   - Use admin panel (see above)
   - Or run: `npm run get:key` (in app directory)

3. **Open URL in browser:**
   - Replace `{encryptedKey}` with your actual key
   - Example: `http://localhost:5052/product/YOUR_ACTUAL_KEY_HERE`

4. **You should see:**
   - Product name
   - Product model  
   - Product description
   - Image carousel (if available)

## ⚠️ Important Notes

- **The encrypted key must be URL-encoded** if it contains special characters
- **Backend must be running** for the page to fetch product data
- **Product must exist** in the database with the corresponding encrypted key
- **QR codes must be generated** before you can get an encrypted key

## 🔍 Finding Your Key

The encrypted key is the same data that's embedded in the QR code. When you:
- Generate QR codes in the admin panel
- Click "Generate Web QR code"
- The displayed QR codes contain these encrypted keys

You can also extract it from the QR code image data if needed.
