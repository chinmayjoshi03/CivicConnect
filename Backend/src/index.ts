import express, { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import User from "./models/User";
import Report from "./models/Report";
import { auth, AuthRequest } from "./middleware/auth";
import { v2 as cloudinary } from "cloudinary";
import multer, { MulterError } from "multer";
import streamifier from "streamifier";

import { GoogleGenAI } from "@google/genai";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY || "",
});

const CIVIC_CATEGORIES = {
  "Water & Supply Management": [
    "water", "pipe", "leak", "burst", "supply", "shortage", "contamination", 
    "drinking water", "tap", "bore well", "water tank", "pipeline"
  ],
  "Electricity": [
    "power", "electricity", "cable", "wire", "transformer", "outage", 
    "blackout", "street light", "electric pole", "power line", "voltage"
  ],
  "Public Health & Safety": [
    "health", "medical", "hospital", "clinic", "ambulance", "safety", 
    "accident", "injury", "disease", "epidemic", "vaccination"
  ],
  "Fire & Emergency Services": [
    "fire", "emergency", "rescue", "disaster", "flood", "earthquake", 
    "burning", "smoke", "evacuation", "hazard", "danger"
  ],
  "Sanitation & Waste Management": [
    "garbage", "waste", "trash", "dustbin", "cleaning", "sewage", "drain", 
    "toilet", "sanitation", "hygiene", "overflow", "dump", "litter"
  ],
  "Roads & Infrastructure": [
    "road", "pothole", "street", "bridge", "footpath", "sidewalk", 
    "traffic", "construction", "repair", "maintenance", "pavement"
  ],
  "Public Transportation": [
    "bus", "transport", "metro", "railway", "station", "traffic signal", 
    "parking", "vehicle", "auto", "rickshaw"
  ],
  "Parks & Environment": [
    "park", "tree", "garden", "environment", "pollution", "noise", 
    "air quality", "green space", "plantation", "encroachment"
  ]
};

function categorizeIssue(description: string): string {
  const lowerDesc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CIVIC_CATEGORIES)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category;
    }
  }
  
  return "General Issues"; // Default category
}





cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    if (allowed) {
      cb(null, true);
    } else {
      cb(new MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files are allowed'));
    }
  }
});

const app = express();
app.use(express.json());

// MongoDB connect
mongoose
  .connect(process.env.MONGO_CONNECT_URI || "")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ---------------------- REGISTER ----------------------
app.post("/api/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashed });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------- LOGIN ----------------------
app.post("/api/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 4. Get current logged-in user
app.get("/users/me", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Image upload endpoint
app.post("/upload", upload.single("image"), async (req: Request & { file?: Express.Multer.File }, res: Response) => {

  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "civic-reports", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      streamifier.createReadStream(req.file!.buffer).pipe(stream);
    });

    res.status(201).json({ imageUrl: result.secure_url });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message || err });
  }
});

// AI Describe endpoint
app.post("/ai/describe", async (req: Request, res: Response) => {
  try {
    // Debug logging
    console.log("Request body:", req.body);
    
    // Check API key first
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        message: "AI service not configured", 
        error: "Gemini API key is missing" 
      });
    }
    
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    // Validate if it's a proper URL
    try {
      new URL(imageUrl);
    } catch {
      return res.status(400).json({ message: "Invalid image URL format" });
    }

    const model = 'gemini-2.5-flash';

    // Enhanced prompt that asks AI to directly categorize and structure response
    const prompt = `
    Analyze this civic issue image and provide a structured response with EXACTLY these 4 fields:

    1. **Description**: A clear, concise description of the civic problem you observe (2-3 sentences max). Be specific about what you see.

    2. **Category**: Choose EXACTLY ONE category from this list that best matches the issue:
       - Water & Supply Management
       - Electricity  
       - Public Health & Safety
       - Fire & Emergency Services
       - Sanitation & Waste Management
       - Roads & Infrastructure
       - Public Transportation
       - Parks & Environment
       - General Issues

    3. **Severity**: Rate as exactly one of: Low, Medium, High

    4. **ActionRequired**: Brief suggested action (1 sentence)

    Focus on civic infrastructure issues. If you cannot clearly identify a civic issue, describe what you observe and categorize as "General Issues".

    Please format your response as:
    Description: [your description]
    Category: [exact category name]
    Severity: [Low/Medium/High]
    ActionRequired: [suggested action]
    `;

    // Validate Cloudinary URL (optional security check)
    if (!imageUrl.includes('cloudinary.com') && !imageUrl.includes('res.cloudinary.com')) {
      console.warn('Non-Cloudinary URL detected:', imageUrl);
    }

    // Fetch image and convert to base64 for Gemini
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return res.status(400).json({ 
        message: "Unable to fetch image from Cloudinary", 
        status: imageResponse.status 
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    
    // Get mime type from response headers or infer from Cloudinary URL
    let mimeType = imageResponse.headers.get('content-type');
    if (!mimeType) {
      if (imageUrl.includes('.png')) mimeType = 'image/png';
      else if (imageUrl.includes('.webp')) mimeType = 'image/webp';
      else if (imageUrl.includes('.gif')) mimeType = 'image/gif';
      else mimeType = 'image/jpeg';
    }

    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
    };

    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
        ],
      },
    ];

    const result = await ai.models.generateContent({
      model,
      config,
      contents,
    });

    // Extract the AI response
    let aiResponse = '';
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      const parts = result.candidates[0].content.parts;
      aiResponse = (parts as any).map((part: any) => part.text).join('');
    } else {
      throw new Error('No response generated from AI');
    }

    console.log("Raw AI Response:", aiResponse);

    // Parse the structured response from AI
    const description = extractField(aiResponse, 'Description');
    const category = extractField(aiResponse, 'Category');
    const severity = extractField(aiResponse, 'Severity');
    const actionRequired = extractField(aiResponse, 'ActionRequired');

    // Validate and clean the category
    const validCategories = [
      "Water & Supply Management", "Electricity", "Public Health & Safety",
      "Fire & Emergency Services", "Sanitation & Waste Management", 
      "Roads & Infrastructure", "Public Transportation", 
      "Parks & Environment", "General Issues"
    ];

    let finalCategory = "General Issues";
    const cleanCategory = category.trim();
    
    // Find exact match or close match
    const exactMatch = validCategories.find(cat => cat.toLowerCase() === cleanCategory.toLowerCase());
    if (exactMatch) {
      finalCategory = exactMatch;
    } else {
      // Fallback: check if category contains key terms
      if (cleanCategory.toLowerCase().includes('sanitation') || cleanCategory.toLowerCase().includes('waste')) {
        finalCategory = "Sanitation & Waste Management";
      } else if (cleanCategory.toLowerCase().includes('road') || cleanCategory.toLowerCase().includes('infrastructure')) {
        finalCategory = "Roads & Infrastructure";
      } else if (cleanCategory.toLowerCase().includes('water')) {
        finalCategory = "Water & Supply Management";
      } else if (cleanCategory.toLowerCase().includes('electric')) {
        finalCategory = "Electricity";
      }
    }

    // Validate severity
    const validSeverities = ["Low", "Medium", "High"];
    let finalSeverity = "Medium";
    const cleanSeverity = severity.trim();
    if (validSeverities.includes(cleanSeverity)) {
      finalSeverity = cleanSeverity;
    }

    // Structure the final response
    const response = {
      description: description.trim() || "Unable to analyze the image properly.",
      category: finalCategory,
      severity: finalSeverity,
      timestamp: new Date().toISOString()
    };

    console.log("Final Response:", response);
    res.json(response);

  } catch (error: any) {
    console.error("AI Description error:", error);
    
    if (error.message?.includes('API_KEY') || error.message?.includes('Invalid API key')) {
      return res.status(500).json({ 
        message: "AI service configuration error",
        error: "Invalid or missing Gemini API key"
      });
    }

    res.status(500).json({ 
      message: "Failed to analyze image", 
      error: error.message || "Unknown error occurred"
    });
  }
});

function extractField(text: string, fieldName: string): string {
  const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n[A-Z]|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}


// Optional: Endpoint to get all available categories
app.get("/api/categories", (req: Request, res: Response) => {
  const categories = [
    "Water & Supply Management",
    "Electricity", 
    "Public Health & Safety",
    "Fire & Emergency Services",
    "Sanitation & Waste Management",
    "Roads & Infrastructure", 
    "Public Transportation",
    "Parks & Environment",
    "General Issues"
  ];

  res.json({
    categories: categories,
    note: "Categories are now determined directly by AI analysis rather than keyword matching"
  });
});

// ------- MAPS INTEGRATION -------
// Reverse Geocoding endpoint - Convert lat/lng to readable address (OpenStreetMap only)
app.post("/location/reverse-geocode", async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;

    // Validate input
    if (!lat || !lng) {
      return res.status(400).json({ 
        message: "Both latitude and longitude are required" 
      });
    }

    // Validate lat/lng ranges
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ 
        message: "Latitude and longitude must be valid numbers" 
      });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ 
        message: "Latitude must be between -90 and 90" 
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        message: "Longitude must be between -180 and 180" 
      });
    }

    // Using OpenStreetMap Nominatim API
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CivicConnect-App/1.0' // Required by Nominatim
        }
      }
    );

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim API error: ${nominatimResponse.status}`);
    }

    const data = await nominatimResponse.json();

    if (data && data.display_name) {
      const address = data.display_name;
      
      // Extract components from Nominatim response
      const addressComponents = data.address || {};
      const addressDetails = {
        fullAddress: address,
        components: {
          street: `${addressComponents.house_number || ''} ${addressComponents.road || ''}`.trim(),
          locality: addressComponents.neighbourhood || addressComponents.suburb || '',
          city: addressComponents.city || addressComponents.town || addressComponents.village || '',
          state: addressComponents.state || '',
          country: addressComponents.country || '',
          postalCode: addressComponents.postcode || ''
        }
      };

      return res.json({ 
        address: address,
        details: addressDetails,
        source: 'openstreetmap'
      });
    } else {
      return res.status(404).json({ 
        message: "No address found for the provided coordinates" 
      });
    }

  } catch (error: any) {
    console.error("Reverse geocoding error:", error);
    
    // Handle different types of errors
    if (error.message?.includes('fetch')) {
      return res.status(503).json({ 
        message: "Geocoding service temporarily unavailable",
        error: "External service error"
      });
    }

    res.status(500).json({ 
      message: "Failed to get address for coordinates", 
      error: error.message || "Unknown error occurred"
    });
  }
});

// Forward Geocoding - Convert address to lat/lng (OpenStreetMap only)
app.post("/location/geocode", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ 
        message: "Address is required" 
      });
    }

    // Using OpenStreetMap Nominatim for forward geocoding
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CivicConnect-App/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      return res.json({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
        boundingBox: result.boundingbox
      });
    }

    res.status(404).json({ 
      message: "No coordinates found for the provided address" 
    });

  } catch (error: any) {
    console.error("Geocoding error:", error);
    res.status(500).json({ 
      message: "Failed to get coordinates for address", 
      error: error.message || "Unknown error occurred"
    });
  }
});

// ---------------------- POST /reports ----------------------
app.post("/api/reports", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { description, location, images, category, severity } = req.body;

    // Validation
    if (!description || !location || !images || !category) {
      return res.status(400).json({ 
        message: "Description, location, images, and category are required" 
      });
    }

    if (!location.lat || !location.lng || !location.address) {
      return res.status(400).json({ 
        message: "Location must include lat, lng, and address" 
      });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ 
        message: "At least one image is required" 
      });
    }

    // Validate location coordinates
    if (location.lat < -90 || location.lat > 90) {
      return res.status(400).json({ 
        message: "Latitude must be between -90 and 90" 
      });
    }

    if (location.lng < -180 || location.lng > 180) {
      return res.status(400).json({ 
        message: "Longitude must be between -180 and 180" 
      });
    }

    // Validate category
    const validCategories = [
      'Water & Supply Management',
      'Electricity',
      'Public Health & Safety',
      'Fire & Emergency Services',
      'Sanitation & Waste Management',
      'Roads & Infrastructure',
      'Public Transportation',
      'Parks & Environment',
      'General Issues'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        message: "Invalid category",
        validCategories 
      });
    }

    // Create new report
    const newReport = new Report({
      userId: req.userId,
      description: description.trim(),
      location: {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng),
        address: location.address.trim(),
      },
      images,
      category,
      severity: severity || 'Medium',
      status: 'Submitted',
      statusHistory: [{
        status: 'Submitted',
        timestamp: new Date(),
        by: 'system',
        comment: 'Report submitted by user',
      }],
    });

    const savedReport = await newReport.save();

    // Populate user details for response
    const populatedReport = await Report.findById(savedReport._id)
      .populate('userId', 'name email')
      .exec();

    res.status(201).json({
      message: "Report submitted successfully",
      report: populatedReport,
    });

  } catch (error: any) {
    console.error("Submit report error:", error);
    res.status(500).json({ 
      message: "Failed to submit report", 
      error: error.message 
    });
  }
});

// ---------------------- GET /reports ----------------------
app.get("/api/reports", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, userId, page = 1, limit = 10 } = req.query;

    // Get current user to check if admin
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build query
    const query: any = {};

    // If user is not admin, only show their own reports
    if (currentUser.role !== 'admin') {
      query.userId = req.userId;
    } else if (userId) {
      // Admin can filter by specific userId
      query.userId = userId;
    }

    // Apply filters
    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const reports = await Report.find(query)
      .populate('userId', 'name email')
      .populate('departmentId', 'name')
      .populate('comments.by', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .exec();

    // Get total count for pagination
    const totalReports = await Report.countDocuments(query);

    res.json({
      reports,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalReports / limitNum),
        totalReports,
        hasNext: pageNum < Math.ceil(totalReports / limitNum),
        hasPrev: pageNum > 1,
      },
      filters: { status, category, userId },
    });

  } catch (error: any) {
    console.error("Get reports error:", error);
    res.status(500).json({ 
      message: "Failed to fetch reports", 
      error: error.message 
    });
  }
});

// ---------------------- GET /reports/:id ----------------------
app.get("/api/reports/:id", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid report ID format" });
    }

    const report = await Report.findById(id)
      .populate('userId', 'name email role')
      .populate('departmentId', 'name description')
      .populate('comments.by', 'name email role')
      .exec();

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Get current user to check permissions
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user can view this report
    // Users can only view their own reports unless they're admin
    if (currentUser.role !== 'admin' && report.userId._id.toString() !== req.userId) {
      return res.status(403).json({ 
        message: "Access denied. You can only view your own reports." 
      });
    }

    // Add additional computed fields
    const reportWithMetadata = {
      ...report.toObject(),
      timeSinceSubmission: new Date().getTime() - report.createdAt.getTime(),
      canEdit: currentUser.role === 'admin' || report.userId._id.toString() === req.userId,
      isOwnReport: report.userId._id.toString() === req.userId,
    };

    res.json({ report: reportWithMetadata });

  } catch (error: any) {
    console.error("Get report by ID error:", error);
    res.status(500).json({ 
      message: "Failed to fetch report", 
      error: error.message 
    });
  }
});

// ---------------------- START SERVER ----------------------
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
