const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const Database = require('./database');
const db = new Database();

const PrinterManager = require('./printerManager');
const printerManager = new PrinterManager(true);

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'demo_secret'
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
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
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'));
        }
    }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✓ Created uploads directory');
}

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PrintMitra API</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #667eea; }
                .status { display: inline-block; padding: 5px 15px; border-radius: 20px; background: #4CAF50; color: white; font-weight: bold; }
                .endpoint { background: #f8f9ff; padding: 10px; margin: 10px 0; border-left: 3px solid #667eea; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>📄 PrintMitra API Server</h1>
                <p><span class="status">ONLINE</span></p>
                <h3>Available Endpoints:</h3>
                <div class="endpoint">GET  /api/status</div>
                <div class="endpoint">GET  /api/config</div>
                <div class="endpoint">POST /api/upload</div>
                <div class="endpoint">POST /api/create-order</div>
                <div class="endpoint">POST /api/verify-payment</div>
                <p><strong>Frontend:</strong> <a href="/index.html">Open Application</a></p>
                <p><strong>Port:</strong> ${PORT}</p>
            </div>
        </body>
        </html>
    `);
});

app.get('/api/config', (req, res) => {
    res.json({
        razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo'
    });
});

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
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
    console.log('\n=== UPLOAD REQUEST ===');
    
    try {
        if (!req.file) {
            console.log('✗ No file in request');
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        console.log('✓ File received:', req.file.originalname);
        console.log('✓ Size:', req.file.size, 'bytes');

        const filePath = req.file.path;
        let pageCount = 0;

        if (req.file.mimetype === 'application/pdf') {
            try {
                pageCount = await countPDFPages(filePath);
                console.log('✓ Page count:', pageCount);
            } catch (error) {
                console.log('⚠ Page count failed, using estimate');
                const fileSizeMB = req.file.size / (1024 * 1024);
                pageCount = Math.max(1, Math.ceil(fileSizeMB / 0.1));
            }
        } else {
            const fileSizeMB = req.file.size / (1024 * 1024);
            pageCount = Math.max(1, Math.ceil(fileSizeMB / 0.05));
            console.log('✓ Estimated pages:', pageCount);
        }

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
        console.log('✓ Stored in database');

        res.json({
            success: true,
            file: {
                id: fileInfo.fileId,
                name: fileInfo.originalName,
                size: fileInfo.size,
                pageCount: pageCount
            }
        });

        console.log('=== UPLOAD SUCCESS ===\n');

    } catch (error) {
        console.error('✗ UPLOAD ERROR:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/create-order', async (req, res) => {
    console.log('\n=== CREATE ORDER ===');
    
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
        console.log('✓ Amount:', amount, 'INR');

        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: { fileId, email, phone }
        };

        const order = await razorpay.orders.create(options);
        console.log('✓ Order created:', order.id);

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

        console.log('=== ORDER SUCCESS ===\n');

    } catch (error) {
        console.error('✗ ORDER ERROR:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/verify-payment', async (req, res) => {
    console.log('\n=== VERIFY PAYMENT ===');
    
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'demo_secret')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        console.log('✓ Signature verified');

        const order = await db.getOrder(razorpay_order_id);
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

        console.log('✓ Collection code:', collectionCode);
        console.log('=== PAYMENT SUCCESS ===\n');

    } catch (error) {
        console.error('✗ PAYMENT ERROR:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/order/:orderId', async (req, res) => {
    try {
        const order = await db.getOrder(req.params.orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        let printStatus = null;
        if (order.print_job_id) {
            printStatus = await printerManager.getJobStatus(order.print_job_id);
        }

        res.json({
            success: true,
            order: { ...order, printStatus }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const transactions = await db.getTransactions({ startDate, endDate, status });
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

async function countPDFPages(pdfPath) {
    const pdfBuffer = await fsPromises.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
}

function calculateAmount(pageCount, settings) {
    const PRICING = { bw: 2, color: 8 };
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

async function cleanupOldFiles() {
    try {
        const files = await fsPromises.readdir(uploadsDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            const stats = await fsPromises.stat(filePath);
            if (now - stats.mtimeMs > maxAge) {
                await fsPromises.unlink(filePath);
                console.log('🗑️ Deleted:', file);
            }
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

setInterval(cleanupOldFiles, 60 * 60 * 1000);

app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║           PrintMitra Server Started                   ║
╠═══════════════════════════════════════════════════════╣
║  Port: ${PORT}                                        
║  Environment: ${process.env.NODE_ENV || 'development'}                              
║  Razorpay: ${process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_demo' ? 'Configured ✓' : 'Demo Mode'}
║  Printer: DEMO (Simulated)                            
╠═══════════════════════════════════════════════════════╣
║  Frontend: http://localhost:${PORT}                   
║  API: http://localhost:${PORT}/api                    
╠═══════════════════════════════════════════════════════╣
║  Ready to accept print jobs!                          ║
╚═══════════════════════════════════════════════════════╝
    `);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => {
        db.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => {
        db.close();
        process.exit(0);
    });
});

module.exports = app;