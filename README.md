# Civic Reports API

A comprehensive backend API for crowdsourced civic issue reporting and resolution system. This enables citizens to report local civic issues (potholes, garbage, water problems, etc.) and allows municipal staff to manage and resolve these reports.

## Features

- **User Authentication** - JWT-based registration and login
- **Image Upload** - Cloudinary integration for image storage
- **AI-Powered Analysis** - Gemini AI for automatic issue description and categorization
- **Location Services** - Reverse geocoding using OpenStreetMap
- **Report Management** - Complete CRUD operations with status tracking
- **Role-based Access** - Citizen and admin user roles
- **Real-time Status Updates** - Complete audit trail with status history

## Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Image Storage**: Cloudinary
- **AI Integration**: Google Gemini AI
- **Location Services**: OpenStreetMap Nominatim API

## Prerequisites

Before running this application, make sure you have:

- Node.js (v16 or higher)
- npm or yarn package manager
- MongoDB database (local or cloud)
- Cloudinary account for image storage
- Google Gemini API key

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd civic-reports-api
```

### 2. Navigate to Backend Directory
```bash
cd backend/
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Create Environment File
Create a `.env` file in the backend directory:
```bash
touch .env
```

### 5. Add Environment Variables
Add the following variables to your `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGO_CONNECT_URI=mongodb://localhost:27017/civic-reports
# Or use MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/civic-reports

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

### 6. Start the Server
```bash
# Development mode with hot reload
npm run dev

# Or production mode
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - User login

### User Profile
- `GET /users/me` - Get current user profile (requires auth)

### Image Management
- `POST /upload` - Upload image to Cloudinary
- `POST /ai/describe` - AI-powered image analysis and categorization

### Location Services
- `POST /location/reverse-geocode` - Convert coordinates to address
- `POST /location/geocode` - Convert address to coordinates

### Reports Management
- `POST /api/reports` - Submit a new civic issue report
- `GET /api/reports` - Get all reports (filtered by user role)
- `GET /api/reports/:id` - Get specific report details

### Utility
- `GET /api/categories` - Get all available issue categories

## Issue Categories

The system supports automatic categorization into these categories:

1. **Water & Supply Management** - Water leaks, supply issues, contamination
2. **Electricity** - Power outages, street lights, electrical hazards
3. **Public Health & Safety** - Health hazards, safety concerns
4. **Fire & Emergency Services** - Fire hazards, emergency situations
5. **Sanitation & Waste Management** - Garbage, waste disposal, cleaning
6. **Roads & Infrastructure** - Potholes, road damage, bridge issues
7. **Public Transportation** - Bus stops, traffic signals, parking
8. **Parks & Environment** - Parks, trees, pollution, green spaces
9. **General Issues** - Other civic concerns

## Database Schema

### Users Collection
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (citizen/admin),
  createdAt: Date
}
```

### Reports Collection
```javascript
{
  userId: ObjectId (ref: Users),
  description: String,
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  images: [String],
  category: String,
  status: String (Submitted/Acknowledged/In Progress/Resolved/Closed),
  severity: String (Low/Medium/High),
  statusHistory: [{
    status: String,
    timestamp: Date,
    by: String,
    comment: String
  }],
  comments: [{
    by: ObjectId (ref: Users),
    text: String,
    timestamp: Date
  }],
  departmentId: ObjectId (ref: Departments),
  createdAt: Date,
  updatedAt: Date
}
```

## Testing with Postman

### Quick Setup
1. Import the provided Postman collection
2. Create environment with `baseUrl = http://localhost:3000`
3. Follow the testing flow:
   - Register user
   - Login (saves auth token automatically)
   - Upload image
   - Get AI description
   - Submit report
   - View reports

### Testing Flow
1. **Register** → `POST /api/register`
2. **Login** → `POST /api/login`
3. **Upload Image** → `POST /upload`
4. **AI Analysis** → `POST /ai/describe`
5. **Submit Report** → `POST /api/reports`
6. **View Reports** → `GET /api/reports`

## Project Structure

```
backend/
├── models/
│   ├── User.ts          # User schema
│   └── Report.ts        # Report schema
├── middleware/
│   └── auth.ts          # JWT authentication middleware
├── .env                 # Environment variables
├── server.ts            # Main application file
└── package.json         # Dependencies and scripts
```

## Environment Setup Guide

### MongoDB Setup
**Local MongoDB:**
```bash
# Install MongoDB locally
# Start MongoDB service
mongod --dbpath /path/to/your/db
```

**MongoDB Atlas (Cloud):**
1. Create account at mongodb.com
2. Create cluster
3. Get connection string
4. Add to MONGO_CONNECT_URI

### Cloudinary Setup
1. Create account at cloudinary.com
2. Go to Dashboard
3. Copy Cloud Name, API Key, and API Secret
4. Add to environment variables

### Google Gemini API Setup
1. Go to Google AI Studio (makersuite.google.com)
2. Create API key
3. Add to GEMINI_API_KEY environment variable

## Development Scripts

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Start production server
npm start

# Build TypeScript
npm run build

# Run tests (if configured)
npm test
```

## Common Issues & Solutions

### Server Won't Start
- Check if MongoDB is running
- Verify all environment variables are set
- Ensure port 3000 is not in use

### Image Upload Fails
- Verify Cloudinary credentials
- Check file size (limit: 5MB)
- Ensure file is valid image format

### AI Description Fails
- Check Gemini API key is valid
- Verify image URL is accessible
- Check API usage limits

### Authentication Issues
- Ensure JWT_SECRET is set
- Check token format: `Bearer <token>`
- Verify token hasn't expired

## API Response Examples

### Successful Report Submission
```json
{
  "message": "Report submitted successfully",
  "report": {
    "_id": "...",
    "description": "Large pothole with standing water",
    "location": {
      "lat": 23.3569,
      "lng": 85.3340,
      "address": "Main Market Road, Ranchi"
    },
    "category": "Roads & Infrastructure",
    "severity": "High",
    "status": "Submitted",
    "createdAt": "2024-09-14T12:45:00.000Z"
  }
}
```

### Error Response
```json
{
  "message": "Validation error description",
  "error": "Detailed error information"
}
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check this README
2. Review API documentation
3. Test with provided Postman collection
4. Check server logs for detailed error information

---

**Note**: This is a development setup guide. For production deployment, additional security measures, monitoring, and scaling considerations should be implemented.
