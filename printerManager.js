// printerManager.js - Printer Communication Manager
const printer = require('pdf-to-printer');

// Demo mode flag (used for presentations, judges, systems without printers)
const isDemoMode = process.env.DEMO_MODE === 'true';

// Mock printer used only in demo mode
const mockPrinter = {
    name: 'Mock_Printer_Demo',
    isDefault: true
};

class PrinterManager {
    constructor() {
        this.defaultPrinter = null;
        this.printQueue = [];
        this.isProcessing = false;
        this.initialize();
    }

    async initialize() {
        try {
            const printers = await this.getAvailablePrinters();
            if (printers.length > 0) {
                this.defaultPrinter = isDemoMode ? mockPrinter.name : printers[0];
                console.log(`Default printer set to: ${this.defaultPrinter}`);
            } else {
                console.log('No printers found. Print functionality will be limited.');
            }
        } catch (error) {
            console.error(
                'Printer initialization error:',
                error?.message || error
            );
        }
    }

    async getAvailablePrinters() {
        try {
            // Demo mode always returns mock printer
            if (isDemoMode) {
                return [mockPrinter.name];
            }

            const printers = await printer.getPrinters();
            return printers.map(p => p.name);
        } catch (error) {
            console.error(
                'Error getting printers:',
                error?.message || error
            );
            return [];
        }
    }

    async getStatus() {
        try {
            const printers = isDemoMode
                ? [mockPrinter]
                : await printer.getPrinters();

            if (printers.length === 0) {
                return {
                    status: 'offline',
                    message: 'No printers available'
                };
            }

            const defaultPrinter = printers[0];

            return {
                status: 'online',
                name: defaultPrinter.name,
                isDefault: defaultPrinter.isDefault || false,
                queueLength: this.printQueue.length,
                availablePrinters: printers.length,
                demoMode: isDemoMode
            };
        } catch (error) {
            return {
                status: 'error',
                message: error?.message || 'Unknown printer error'
            };
        }
    }

    async print(job) {
        const jobId = `JOB_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

        const printJob = {
            id: jobId,
            ...job,
            status: 'queued',
            createdAt: new Date(),
            attempts: 0
        };

        this.printQueue.push(printJob);
        this.processPrintQueue();

        return jobId;
    }

    async processPrintQueue() {
        if (this.isProcessing || this.printQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.printQueue.length > 0) {
            const job = this.printQueue[0];

            try {
                job.status = 'printing';
                job.startedAt = new Date();

                const options = this.buildPrintOptions(job.settings);

                if (this.defaultPrinter && !isDemoMode) {
                    await printer.print(job.filePath, {
                        printer: this.defaultPrinter,
                        ...options
                    });
                } else {
                    console.log('Demo mode active. Simulating print job...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                job.status = 'completed';
                job.completedAt = new Date();

                console.log(`Print job ${job.id} completed successfully`);
            } catch (error) {
                console.error(`Print job ${job.id} failed:`, error);

                job.status = 'failed';
                job.error = error?.message || 'Unknown print error';
                job.attempts++;

                if (job.attempts < 3) {
                    console.log(
                        `Retrying job ${job.id} (attempt ${job.attempts + 1})`
                    );
                    job.status = 'queued';
                    this.printQueue.push(job);
                }
            }

            this.printQueue.shift();
        }

        this.isProcessing = false;
    }

    buildPrintOptions(settings) {
        const options = {};

        if (settings.color === 'bw') {
            options.color = false;
        }

        if (settings.copies) {
            options.copies = settings.copies;
        }

        if (settings.sides === 'double') {
            options.duplex = 'long';
        }

        if (settings.pageRange) {
            options.pages = settings.pageRange;
        }

        if (settings.size === 'letter') {
            options.paperSize = 'Letter';
        } else {
            options.paperSize = 'A4';
        }

        return options;
    }

    async getJobStatus(jobId) {
        const queuedJob = this.printQueue.find(j => j.id === jobId);

        if (queuedJob) {
            return {
                jobId: jobId,
                status: queuedJob.status,
                position: this.printQueue.indexOf(queuedJob) + 1,
                error: queuedJob.error
            };
        }

        return {
            jobId: jobId,
            status: 'completed'
        };
    }

    async cancelJob(jobId) {
        const index = this.printQueue.findIndex(j => j.id === jobId);

        if (index !== -1) {
            const job = this.printQueue[index];
            if (job.status === 'queued') {
                this.printQueue.splice(index, 1);
                return { success: true, message: 'Job cancelled' };
            } else {
                return {
                    success: false,
                    message: 'Job already in progress'
                };
            }
        }

        return { success: false, message: 'Job not found' };
    }
}

module.exports = PrinterManager;