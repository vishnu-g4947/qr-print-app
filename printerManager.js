class PrinterManager {
    constructor(demoMode = false) {
        this.demoMode = demoMode;
        this.defaultPrinter = 'Demo Printer (Virtual)';
        this.printQueue = [];
        this.isProcessing = false;
        console.log('✓ Printer: DEMO mode (virtual printer)');
    }

    async getStatus() {
        return {
            status: 'online',
            name: 'Demo Printer (Virtual)',
            isDefault: true,
            queueLength: this.printQueue.length,
            availablePrinters: 1,
            mode: 'demo'
        };
    }

    async print(job) {
        const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
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
        if (this.isProcessing || this.printQueue.length === 0) return;

        this.isProcessing = true;

        while (this.printQueue.length > 0) {
            const job = this.printQueue[0];
            
            try {
                job.status = 'printing';
                job.startedAt = new Date();

                console.log(`\n🖨️  DEMO PRINT`);
                console.log(`   Job: ${job.id}`);
                console.log(`   Code: ${job.collectionCode}`);
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                job.status = 'completed';
                job.completedAt = new Date();
                console.log(`✓  COMPLETED\n`);
                
            } catch (error) {
                console.error(`✗ Job failed:`, error);
                job.status = 'failed';
                job.error = error.message;
            }

            this.printQueue.shift();
        }

        this.isProcessing = false;
    }

    async getJobStatus(jobId) {
        const queuedJob = this.printQueue.find(j => j.id === jobId);
        if (queuedJob) {
            return {
                jobId,
                status: queuedJob.status,
                position: this.printQueue.indexOf(queuedJob) + 1
            };
        }
        return { jobId, status: 'completed' };
    }
}

module.exports = PrinterManager;