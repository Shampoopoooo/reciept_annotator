import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import sharp from "sharp";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Multer for file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  // Support URL encoded and JSON body Parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Endpoints
  
  // POST /annotate_receipt
  app.post("/annotate_receipt", upload.single("photo"), async (req, res) => {
    try {
      const file = req.file;
      const taxRateInput = (req.body && req.body.tax_rate !== undefined) ? parseFloat(req.body.tax_rate) : NaN;

      if (!file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      if (isNaN(taxRateInput) || taxRateInput < 0 || taxRateInput > 100) {
        return res.status(400).json({ error: "Invalid tax rate. Please provide a value between 0 and 100." });
      }

      // Convert buffer to base64 for Gemini
      const base64Image = file.buffer.toString("base64");

      // Extract information using Gemini
      const extractionPrompt = `
        Analyze this receipt and extract:
        1. The total amount paid (grand total).
        2. The tax amount or the tax rate percentage (if explicitly shown).
      `;

      console.log("Analyzing receipt using gemini-3.5-flash...");
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            parts: [
              { text: extractionPrompt },
              { inlineData: { mimeType: file.mimetype, data: base64Image } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              total_amount: {
                type: Type.NUMBER,
                description: "The total amount paid including tax (grand total)"
              },
              tax_amount: {
                type: Type.NUMBER,
                description: "The tax amount paid in dollars, if specified; otherwise null"
              },
              tax_rate_percent: {
                type: Type.NUMBER,
                description: "The tax rate percentage if explicitly specified; otherwise null"
              }
            },
            required: ["total_amount"]
          }
        }
      });

      console.log("Gemini Raw Response text:", geminiResponse.text);
      if (!geminiResponse.text) {
        throw new Error("Blank response received from Gemini engine. Please try another image with better lighting.");
      }

      let extractedData;
      try {
        extractedData = JSON.parse(geminiResponse.text);
      } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", geminiResponse.text);
        throw new Error("The receipt contents could not be parsed. Please verify the receipt image is clear and try again.");
      }

      let totalAmount = extractedData.total_amount;
      if (typeof totalAmount !== "number" || isNaN(totalAmount)) {
        totalAmount = parseFloat(totalAmount) || 0;
      }

      if (totalAmount <= 0) {
        throw new Error("No readable purchase amount was found on this receipt. Please crop or retake a clearer photo.");
      }
      
      // Calculate amount before tax
      let amountBeforeTax = 0;
      if (extractedData.tax_amount !== null && extractedData.tax_amount !== undefined) {
        amountBeforeTax = totalAmount - extractedData.tax_amount;
      } else if (extractedData.tax_rate_percent !== null && extractedData.tax_rate_percent !== undefined) {
        amountBeforeTax = totalAmount / (1 + extractedData.tax_rate_percent / 100);
      } else {
        // Fallback: Guess a default tax rate of 8.875% (NYC)
        amountBeforeTax = totalAmount / 1.08875; 
      }

      if (isNaN(amountBeforeTax) || amountBeforeTax <= 0) {
        amountBeforeTax = totalAmount;
      }

      const newTotalAmount = amountBeforeTax * (1 + taxRateInput / 100);

      // Create Annotation Text
      const annotationText = `If tax were ${taxRateInput}%, the total amount would be $${newTotalAmount.toFixed(2)}.`;

      // Get image dimensions for dynamic SVG sizing
      const metadata = await sharp(file.buffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 1200;

      // Create SVG overlay for annotation
      // Red on yellow text
      const fontSize = Math.max(18, Math.floor(width / 24));
      const padding = 10;
      const svgOverlay = `
        <svg width="${width}" height="${height}">
          <rect x="0" y="${height - fontSize * 2.2}" width="${width}" height="${fontSize * 2.2}" fill="yellow" opacity="0.9" />
          <text x="${width / 2}" y="${height - fontSize * 0.8}" font-family="sans-serif" font-size="${fontSize}" fill="red" font-weight="bold" text-anchor="middle">
            ${annotationText}
          </text>
        </svg>
      `;

      // Process image with sharp
      const annotatedImageBuffer = await sharp(file.buffer)
        .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
        .toBuffer();

      const base64Annotated = annotatedImageBuffer.toString("base64");

      res.json({
        amount_before_tax: parseFloat(amountBeforeTax.toFixed(2)),
        receipt: {
          data: base64Annotated,
          mimeType: file.mimetype
        }
      });

    } catch (error) {
      console.error("Error processing receipt:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error processing the receipt." });
    }
  });

  // Vite/Static middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
