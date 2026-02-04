# PrintMitra - Self-Service Printing System

Complete self-service printing solution with Razorpay payment integration.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your Razorpay keys
```

3. Start server:
```bash
npm run dev
```

4. Open browser:
```
http://localhost:3000
```

## Features

- PDF/DOC/DOCX upload
- Real-time page counting
- Payment via Razorpay
- Demo printer mode
- SQLite database
- Transaction tracking

## API Endpoints

- `GET /api/status` - System status
- `POST /api/upload` - Upload document
- `POST /api/create-order` - Create order
- `POST /api/verify-payment` - Verify payment

## Testing

Use Razorpay test card:
- Card: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date

## License

MIT