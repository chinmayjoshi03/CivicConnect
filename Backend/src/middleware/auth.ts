import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Use the same JWT_SECRET as in your login endpoint
    const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
    
    // Your login endpoint creates token with { id: user._id }
    // So we need to destructure 'id' not 'userId'
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    
    // Set req.userId from decoded.id
    req.userId = decoded.id;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};