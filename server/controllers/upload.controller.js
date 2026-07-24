import multer from 'multer';
import StorageService from '../services/storageService.js'; // Import the factory
 


// 1. Initialize the storage service
const storageService = StorageService();

// Configure Multer for Memory Storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

/**
 * @route   POST /api/upload/single
 */

import asyncHandler from '../utils/asyncHandler.js';

// POST '/single'
export const postSingle = asyncHandler(async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });

        const folder = req.body.folder || "uploads";
        // Construct the key (path) for ImageKit
        const key = `${folder}/${Date.now()}-${req.file.originalname}`;

        // 2. Use the initialized service's upload method
        const result = await storageService.upload(req.file.buffer, key);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST '/multiple'
export const postMultiple = asyncHandler(async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files provided" });
        }

        const folder = req.body.folder || "bulk_uploads";
        
        // 3. Upload all files in parallel using the service
        const uploadPromises = req.files.map(file => {
            const key = `${folder}/${Date.now()}-${file.originalname}`;
            return storageService.upload(file.buffer, key);
        });

        const results = await Promise.all(uploadPromises);
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
