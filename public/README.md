# PrintMitra - Self-Service Printing System

A complete self-service printing solution with QR code integration, Razorpay payment gateway, and automated printer management.

## Features

- ✅ **File Upload & Processing** - PDF, DOC, DOCX support with automatic conversion
- ✅ **Accurate Page Counting** - Real PDF page count using pdf-lib
- ✅ **Print Options** - Color/B&W, paper size, duplex, copies, page ranges
- ✅ **Payment Integration** - Razorpay payment gateway with verification
- ✅ **Printer Management** - Real-time printer status and job queue
- ✅ **Database Storage** - SQLite database for transaction records
- ✅ **QR Code Ready** - Mobile-optimized interface
- ✅ **Collection Codes** - Unique 4-digit codes for document collection

## Installation

### Prerequisites

- Node.js 14+ and npm
- LibreOffice (for DOC/DOCX conversion)
- Printer installed on system

### Setup

1. **Clone and Install Dependencies**
```bash
npm install
```

2. **Install LibreOffice** (for document conversion)

**Ubuntu/Debian:**
```bash
sudo apt-get install libreoffice
```

**Windows:**
Download from https://www.libreoffice.org/download

**macOS:**
```bash
brew install libreoffice
```

3. **Configure Environment Variables**

Create a `.env` file:
```env
PORT=3000
RAZORPAY_KEY_ID=your_razorpay_key_here
RAZORPAY_KEY_SECRET=your_razorpay_secret_here
NODE_ENV=development
```

4. **Start the Server**
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Project Structure
```
printmitra/
├── server.js           # Main Express server
├── database.js         # SQLite database manager
├── printerManager.js   # Printer communication handler
├── package.json        # Dependencies
├── .env               # Environment variables
├── public/
│   └── index.html     # Frontend interface
├── uploads/           # Temporary file storage
└── printmitra.db      # SQLite database
```

## API Endpoints

### GET /api/status
Check system and printer status

### POST /api/upload
Upload and process document
- **Body:** multipart/form-data with 'document' field
- **Returns:** File ID and page count

### POST /api/create-order
Create Razorpay order
- **Body:** `{ fileId, printSettings, email, phone }`
- **Returns:** Razorpay order details

### POST /api/verify-payment
Verify payment and send to printer
- **Body:** Razorpay payment response
- **Returns:** Order ID and collection code

### GET /api/order/:orderId
Get order status and print job details

### GET /api/transactions
Get transaction history (admin)

## Database Schema

### Files Table
- file_id (TEXT, unique)
- original_name (TEXT)
- file_path (TEXT)
- mime_type (TEXT)
- size (INTEGER)
- page_count (INTEGER)
- uploaded_at (DATETIME)

### Orders Table
- order_id (TEXT, unique)
- file_id (TEXT)
- amount (REAL)
- print_settings (TEXT/JSON)
- email (TEXT)
- phone (TEXT)
- status (TEXT)
- payment_id (TEXT)
- collection_code (INTEGER)
- print_job_id (TEXT)
- created_at, paid_at, completed_at (DATETIME)

### Print Jobs Table
- job_id (TEXT, unique)
- order_id (TEXT)
- printer_name (TEXT)
- status (TEXT)
- pages_printed (INTEGER)
- started_at, completed_at (DATETIME)
- error_message (TEXT)

## Razorpay Integration

1. **Sign up** at https://razorpay.com
2. Get your **Key ID** and **Key Secret** from Dashboard
3. Add them to `.env` file
4. Test mode uses test keys (prefix: `rzp_test_`)
5. Production uses live keys (prefix: `rzp_live_`)

## Printer Configuration

The system automatically detects the default printer. To configure:

1. Ensure printer is installed and set as default
2. Test print functionality:
```bash
node -e "require('./printerManager.js')"
```

## Usage Flow

1. User scans QR code → Opens web interface
2. User uploads document → Backend counts pages
3. User selects print options → Price calculated
4. User enters email/phone → Razorpay order created
5. User completes payment → Payment verified
6. Print job sent to printer → Collection code displayed
7. User collects printout using code

## Security Considerations

- ✅ File validation (type, size)
- ✅ Razorpay signature verification
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting recommended for production
- ✅ HTTPS required for production
- ✅ Environment variables for secrets

## Production Deployment

1. **Set environment to production**
```env
NODE_ENV=production
```

2. **Use HTTPS**
- Configure SSL certificate
- Update API_URL in frontend

3. **Add rate limiting**
```bash
npm install express-rate-limit
```

4. **Setup PM2 for process management**
```bash
npm install -g pm2
pm2 start server.js --name printmitra
pm2 save
pm2 startup
```

5. **Configure reverse proxy (Nginx)**

6. **Setup backup for database**

## Troubleshooting

**Printer not detected:**
- Check printer installation
- Verify printer is online
- Check system print queue

**File conversion fails:**
- Ensure LibreOffice is installed
- Check file permissions
- Verify file format

**Payment fails:**
- Check Razorpay credentials
- Verify network connectivity
- Check browser console for errors

## License

MIT License - See LICENSE file

## Support

For issues or questions, please contact support@printmitra.com