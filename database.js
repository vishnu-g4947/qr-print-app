const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(
            path.join(__dirname, 'printmitra.db'),
            (err) => {
                if (err) {
                    console.error('Database error:', err);
                } else {
                    console.log('✓ Database connected');
                    this.initialize();
                }
            }
        );
    }

    initialize() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id TEXT UNIQUE NOT NULL,
                    original_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    mime_type TEXT,
                    size INTEGER,
                    page_count INTEGER,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.db.run(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT UNIQUE NOT NULL,
                    file_id TEXT NOT NULL,
                    amount REAL NOT NULL,
                    print_settings TEXT,
                    email TEXT,
                    phone TEXT,
                    status TEXT DEFAULT 'created',
                    payment_id TEXT,
                    collection_code INTEGER,
                    print_job_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    paid_at DATETIME,
                    completed_at DATETIME,
                    FOREIGN KEY (file_id) REFERENCES files(file_id)
                )
            `);

            this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)');
        });
    }

    async checkConnection() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1', (err) => {
                if (err) reject(err);
                else resolve('connected');
            });
        });
    }

    async storeFileInfo(fileInfo) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO files (file_id, original_name, file_path, mime_type, size, page_count) VALUES (?, ?, ?, ?, ?, ?)`;
            this.db.run(sql, [fileInfo.fileId, fileInfo.originalName, fileInfo.filePath, fileInfo.mimeType, fileInfo.size, fileInfo.pageCount],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getFileInfo(fileId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM files WHERE file_id = ?', [fileId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async createOrder(orderData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO orders (order_id, file_id, amount, print_settings, email, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            this.db.run(sql, [orderData.orderId, orderData.fileId, orderData.amount, orderData.printSettings, orderData.email, orderData.phone, orderData.status],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getOrder(orderId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM orders WHERE order_id = ?', [orderId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async updateOrder(orderId, updates) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updates);
            values.push(orderId);
            const sql = `UPDATE orders SET ${fields} WHERE order_id = ?`;
            this.db.run(sql, values, function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async getTransactions(filters = {}) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT o.*, f.original_name, f.page_count FROM orders o JOIN files f ON o.file_id = f.file_id WHERE 1=1`;
            const params = [];

            if (filters.startDate) {
                sql += ' AND o.created_at >= ?';
                params.push(filters.startDate);
            }
            if (filters.endDate) {
                sql += ' AND o.created_at <= ?';
                params.push(filters.endDate);
            }
            if (filters.status) {
                sql += ' AND o.status = ?';
                params.push(filters.status);
            }

            sql += ' ORDER BY o.created_at DESC LIMIT 100';

            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;