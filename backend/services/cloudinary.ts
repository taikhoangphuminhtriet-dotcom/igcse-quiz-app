const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (these should be in your .env file)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dqswcn5u0',
    api_key: process.env.CLOUDINARY_API_KEY || '667675634458611',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'GIccFusJgpc-fI4wD6ImQ5sZ6R4t',
});

class CloudinaryService {
    static async uploadPDF(filePath: string, folder: string = 'quiz-pdfs'): Promise<string> {
        try {
            console.log(`📤 Uploading PDF to Cloudinary: ${filePath}`);

            const result = await cloudinary.uploader.upload(filePath, {
                resource_type: 'raw', // For non-image files like PDFs
                folder: folder,
                use_filename: true,
                unique_filename: true,
            });

            console.log(`✅ PDF uploaded successfully: ${result.secure_url}`);
            return result.secure_url;
        } catch (error) {
            console.error('❌ Error uploading PDF to Cloudinary:', error);
            throw new Error(`Failed to upload PDF: ${error.message}`);
        }
    }

    static async uploadMultiplePDFs(filePaths: {
        insert: string;
        questions: string;
        markscheme: string;
    }): Promise<{
        insert: string;
        questions: string;
        markscheme: string;
    }> {
        try {
            console.log('📤 Uploading multiple PDFs to Cloudinary...');

            const [insertUrl, questionsUrl, markschemeUrl] = await Promise.all([
                this.uploadPDF(filePaths.insert, 'quiz-pdfs/inserts'),
                this.uploadPDF(filePaths.questions, 'quiz-pdfs/questions'),
                this.uploadPDF(filePaths.markscheme, 'quiz-pdfs/markschemes'),
            ]);

            console.log('✅ All PDFs uploaded successfully');

            return {
                insert: insertUrl,
                questions: questionsUrl,
                markscheme: markschemeUrl,
            };
        } catch (error) {
            console.error('❌ Error uploading multiple PDFs:', error);
            throw error;
        }
    }

    static async deletePDF(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            console.log(`✅ PDF deleted from Cloudinary: ${publicId}`);
        } catch (error) {
            console.error('❌ Error deleting PDF from Cloudinary:', error);
            throw error;
        }
    }

    static getPublicIdFromUrl(url: string): string {
        // Extract public ID from Cloudinary URL
        const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\./);
        return matches ? matches[1] : '';
    }
}

module.exports = { CloudinaryService };
export { }; // Force TypeScript to treat this as a module
