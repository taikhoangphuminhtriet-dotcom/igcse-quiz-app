const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dqswcn5u0',
    api_key: process.env.CLOUDINARY_API_KEY || '667675634458611',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'GIccFusJgpc-fI4wD6ImQ5sZ6R4',
});

class UploadService {
    static async uploadPDF(fileBuffer: Buffer, filename: string, subject: string) {
        try {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'raw',
                        public_id: `igcse-papers/${Date.now()}-${filename}`,
                        tags: ['igcse', 'paper', subject.toLowerCase()],
                        folder: 'igcse-papers'
                    },
                    (error: any, result: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(fileBuffer);
            });

            return result;
        } catch (error) {
            console.error('Upload error:', error);
            throw new Error('Failed to upload PDF');
        }
    }

    static async deletePDF(publicId: string) {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Delete error:', error);
            throw new Error('Failed to delete PDF');
        }
    }
}

module.exports = { UploadService };
export { }; // Force TypeScript to treat this as a module
