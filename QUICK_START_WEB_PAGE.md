# Quick Start: Public Web Page

## 🚀 Start the Web Server

### Step 1: Start Backend (Required)
```bash
cd backend
npm start
```
Backend should run on `http://localhost:5052`

### Step 2: Start Web Server (Optional - for port 3000)
```bash
cd app
npm run serve:web
```
Web server will run on `http://localhost:3000`

## 📋 Get a Sample Encrypted Key

### Method 1: From Admin Panel (Easiest)

1. **Start Frontend:**
   ```bash
   cd frontend
   npm start
   ```

2. **Login to Admin Panel:**
   - Open `http://localhost:3000` (or your frontend port)
   - Login with your credentials

3. **Generate QR Codes:**
   - Select a product
   - Enter amount (e.g., 1)
   - Click **"Generate QR code"**
   - Click **"Generate Web QR code"**
   - Copy one of the encrypted keys shown

### Method 2: Using Script
```bash
cd app
npm run get:key
```
*(Requires backend to be running)*

## 🌐 Sample URLs

Once you have an encrypted key, replace `YOUR_KEY_HERE` in these URLs:

### Via Backend Server:
```
http://localhost:5052/product/YOUR_KEY_HERE
```

### Via Web Server (if running):
```
http://localhost:3000/product/YOUR_KEY_HERE
```

## 📝 Example

If your encrypted key is:
```
U2FsdGVkX1+abc123xyz789def456ghi012jkl345mno678pqr901stu234vwx567yz
```

**Your test URL would be:**
```
http://localhost:5052/product/U2FsdGVkX1+abc123xyz789def456ghi012jkl345mno678pqr901stu234vwx567yz
```

## ✅ What You Should See

When you open the URL, you'll see:
- ✅ Product name (large, blue heading)
- ✅ Product model
- ✅ Product description
- ✅ Image carousel (if product has images)
- ✅ Responsive design (works on mobile/desktop)

## 🔧 Troubleshooting

### Backend not running?
```bash
cd backend
npm start
```

### No products in database?
- Create a product in the admin panel first
- Then generate QR codes for it

### "Error loading product"?
- Check the encrypted key is correct
- Verify backend is running on port 5052
- Check browser console for errors

### Images not showing?
- Verify images are uploaded for the product
- Check backend `/files/` endpoint is accessible

## 💡 Quick Test

1. **Start backend:** `cd backend && npm start`
2. **Get key from admin panel** (see Method 1 above)
3. **Open URL in browser:** `http://localhost:5052/product/YOUR_KEY`
4. **See product details!** 🎉

---

**Note:** The encrypted key is a long string that looks like: `U2FsdGVkX1+...` (usually 100+ characters)
