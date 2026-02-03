// server.js - Main Express Server
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database Setup
const Database = require('./database');
const db = new Database();

// Printer Manager
const PrinterManager = require('./printerManager');
const printerManager = new PrinterManager();

// Razorpay Configuration
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_HERE',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_SECRET_HERE'
});

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdir(uploadDir, { recursive: true })
            .then(() => cb(null, uploadDir))
            .catch(err => cb(err));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PNG, JPG, and JPEG are allowed.'));
        }
    }
});

// ==================== ROUTES ====================

// Get Razorpay Configuration
app.get('/api/config', (req, res) => {
    res.json({
        razorpayKey: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_HERE'
    });
});

// Health Check & Printer Status
app.get('/api/status', async (req, res) => {
    try {
        const printerStatus = await printerManager.getStatus();
        const dbStatus = await db.checkConnection();
        
        res.json({
            success: true,
            status: {
                server: 'online',
                printer: printerStatus,
                database: dbStatus,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Upload and Analyze Document
app.post('/api/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const filePath = req.file.path;
        let pageCount = 0;

        // Count pages
        if (req.file.mimetype === 'application/pdf') {
            pageCount = await countPDFPages(filePath);
        } else if (req.file.mimetype.startsWith('image/')) {
            // Images are treated as single-page documents
            pageCount = 1;
        } else {
            // For DOC/DOCX, estimate or convert first
            pageCount = Math.floor(Math.random() * 20) + 1; // Placeholder
        }

        // Store file info in database
        const fileInfo = {
            fileId: req.file.filename,
            originalName: req.file.originalname,
            filePath: filePath,
            mimeType: req.file.mimetype,
            size: req.file.size,
            pageCount: pageCount,
            uploadedAt: new Date().toISOString()
        };

        await db.storeFileInfo(fileInfo);

        res.json({
            success: true,
            file: {
                id: fileInfo.fileId,
                name: fileInfo.originalName,
                size: fileInfo.size,
                pageCount: pageCount
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create Razorpay Order
app.post('/api/create-order', async (req, res) => {
    try {
        const { fileId, printSettings, email, phone } = req.body;

        if (!fileId || !printSettings || !email || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const fileInfo = await db.getFileInfo(fileId);
        if (!fileInfo) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        const amount = calculateAmount(fileInfo.page_count, printSettings);

        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                fileId: fileId,
                email: email,
                phone: phone
            }
        };

        const order = await razorpay.orders.create(options);

        await db.createOrder({
            orderId: order.id,
            fileId: fileId,
            amount: amount,
            printSettings: JSON.stringify(printSettings),
            email: email,
            phone: phone,
            status: 'created'
        });

        res.json({
            success: true,
            order: {
                id: order.id,
                amount: amount,
                currency: 'INR'
            }
        });

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verify Payment and Send to Printer
app.post('/api/verify-payment', async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        const order = await db.getOrder(razorpay_order_id);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        const fileInfo = await db.getFileInfo(order.file_id);
        const collectionCode = Math.floor(1000 + Math.random() * 9000);

        await db.updateOrder(razorpay_order_id, {
            status: 'paid',
            payment_id: razorpay_payment_id,
            collection_code: collectionCode,
            paid_at: new Date().toISOString()
        });

        const printSettings = JSON.parse(order.print_settings);
        const printJobId = await printerManager.print({
            filePath: fileInfo.file_path,
            settings: printSettings,
            orderId: razorpay_order_id,
            collectionCode: collectionCode
        });

        await db.updateOrder(razorpay_order_id, {
            print_job_id: printJobId,
            status: 'printing'
        });

        res.json({
            success: true,
            order: {
                orderId: razorpay_order_id,
                collectionCode: collectionCode,
                printJobId: printJobId
            }
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Order Status
app.get('/api/order/:orderId', async (req, res) => {
    try {
        const order = await db.getOrder(req.params.orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        let printStatus = null;
        if (order.print_job_id) {
            printStatus = await printerManager.getJobStatus(order.print_job_id);
        }

        res.json({
            success: true,
            order: {
                ...order,
                printStatus: printStatus
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Transaction History
app.get('/api/transactions', async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const transactions = await db.getTransactions({
            startDate,
            endDate,
            status
        });

        res.json({
            success: true,
            transactions: transactions
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== HELPER FUNCTIONS ====================

async function countPDFPages(pdfPath) {
    try {
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        return pdfDoc.getPageCount();
    } catch (error) {
        console.error('Error counting PDF pages:', error);
        throw new Error('Failed to count PDF pages');
    }
}

function calculateAmount(pageCount, settings) {
    const PRICING = {
        bw: 2,
        color: 8
    };

    const pricePerPage = PRICING[settings.color] || PRICING.bw;
    const copies = settings.copies || 1;
    
    let totalPages = pageCount;
    if (settings.pageRange) {
        totalPages = calculatePageRangeCount(settings.pageRange, pageCount);
    }

    return totalPages * copies * pricePerPage;
}

function calculatePageRangeCount(pageRange, maxPages) {
    if (!pageRange) return maxPages;

    const ranges = pageRange.split(',');
    let count = 0;

    ranges.forEach(range => {
        range = range.trim();
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()));
            count += Math.min(end, maxPages) - Math.max(start, 1) + 1;
        } else {
            const page = parseInt(range);
            if (page <= maxPages) count++;
        }
    });

    return Math.max(count, 0);
}

// Cleanup old files
async function cleanupOldFiles() {
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const files = await fs.readdir(uploadDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(uploadDir, file);
            const stats = await fs.stat(filePath);
            if (now - stats.mtimeMs > maxAge) {
                await fs.unlink(filePath);
                console.log(`Deleted old file: ${file}`);
            }
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

setInterval(cleanupOldFiles, 60 * 60 * 1000);

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║           PrintMitra Server Started                   ║
╠═══════════════════════════════════════════════════════╣
║  Port: ${PORT}                                        
║  Environment: ${process.env.NODE_ENV || 'development'}                              
║  Razorpay: ${process.env.RAZORPAY_KEY_ID ? 'Configured ✓' : 'Not Configured ✗'}                       
╠═══════════════════════════════════════════════════════╣
║  Frontend URL: http://localhost:${PORT}               
║  API URL: http://localhost:${PORT}/api                
╠═══════════════════════════════════════════════════════╣
║  Endpoints:                                           ║
║  - GET  /api/status                                   ║
║  - GET  /api/config                                   ║
║  - POST /api/upload                                   ║
║  - POST /api/create-order                             ║
║  - POST /api/verify-payment                           ║
║  - GET  /api/order/:orderId                           ║
║  - GET  /api/transactions                             ║
╚═══════════════════════════════════════════════════════╝
    `);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    db.close();
    process.exit(0);
});

module.exports = app;