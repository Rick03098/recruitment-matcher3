// pages/api/uploadAndParseJD.js
import { formidable } from 'formidable'; // Use formidable for parsing form data
import fs from 'fs/promises'; // Use promise-based fs for async operations
import OpenAI from 'openai'; // Import the OpenAI library

// --- OpenAI Client Initialization ---
// Make sure OPENAI_API_KEY is set in your .env.local
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai;
if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
  try {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    console.log("[API /uploadAndParseJD] OpenAI client initialized successfully.");
  } catch (error) {
    console.error("[API /uploadAndParseJD] Error initializing OpenAI client:", error);
    openai = null;
  }
} else {
  console.warn("[API /uploadAndParseJD] OpenAI API Key not configured correctly in .env.local.");
  openai = null;
}
// --- Initialization End ---

// --- Formidable Configuration ---
// Disable Next.js body parsing, let formidable handle it
export const config = {
  api: {
    bodyParser: false,
  },
};

const formidableOptions = {
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit for JD images
    filter: function ({ name, originalFilename, mimetype }) {
        // Filter to allow only common image types
        const allowed = mimetype && mimetype.startsWith('image/'); // Allow any image type
        if (!allowed) {
            console.warn(`[API /uploadAndParseJD] Rejected file upload: ${originalFilename} (type: ${mimetype}). Only images are allowed.`);
        }
        return allowed;
    }
};
// --- Configuration End ---


// --- API Handler ---
export default async function handler(req, res) {
  // --- 1. Check Request Method and OpenAI Client ---
  if (req.method !== 'POST') {
    console.log(`[API /uploadAndParseJD] Received non-POST request (${req.method})`);
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed. Use POST.` });
  }

  if (!openai) {
    console.error("[API /uploadAndParseJD] OpenAI client is not available.");
    return res.status(500).json({ success: false, message: "OpenAI service configuration error." });
  }

  console.log('[API /uploadAndParseJD] Received POST request. Processing...');

  // --- 2. Parse Form Data with Formidable ---
  const form = formidable(formidableOptions);

  try {
    const [fields, files] = await form.parse(req); // Use promise-based parsing

    // --- 3. Get Uploaded File ---
    const uploadedFile = files.jobFile?.[0]; // Assuming frontend sends file with key 'jobFile'

    if (!uploadedFile) {
      console.error("[API /uploadAndParseJD] No file found in the request (expected key 'jobFile'). Files object:", files);
      return res.status(400).json({ success: false, message: "No image file uploaded or incorrect field name used." });
    }

    const filePath = uploadedFile.filepath; // Path to the temporary uploaded file
    const originalFilename = uploadedFile.originalFilename;
    const mimeType = uploadedFile.mimetype;
    console.log(`[API /uploadAndParseJD] File received: ${originalFilename} (${mimeType}), Temp path: ${filePath}`);

    // --- 4. Read File and Convert to Base64 ---
    let base64Image;
    try {
      const imageBuffer = await fs.readFile(filePath);
      base64Image = imageBuffer.toString('base64');
      console.log(`[API /uploadAndParseJD] Image file read and converted to Base64 (length: ${base64Image.length})`);
    } catch (readError) {
        console.error(`[API /uploadAndParseJD] Error reading file ${filePath}:`, readError);
        // Clean up the temporary file if reading fails
        await fs.unlink(filePath).catch(unlinkErr => console.error(`Error cleaning up temp file ${filePath}:`, unlinkErr));
        return res.status(500).json({ success: false, message: 'Error reading uploaded image file.' });
    }

    // --- 5. Call OpenAI GPT-4o ---
    console.log('[API /uploadAndParseJD] Sending image to OpenAI GPT-4o for analysis...');
    let extractedText = '';
    let structuredData = null;

    try {
      const response = await openai.chat.completions.create({
        // model: "gpt-4o", // Use the latest vision-capable model
        model: "gpt-4o-mini", // Or use the mini version for potentially faster/cheaper results
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                // Adjust the prompt as needed:
                text: `Analyze the following job description image. Extract the full text accurately. Then, based on the extracted text, provide a JSON object containing the key requirements. The JSON object should have keys: "jobTitle" (string), "requiredSkills" (array of strings), "preferredSkills" (array of strings), "yearsExperience" (string, e.g., "3-5 years", "5+", or null), "educationLevel" (string, e.g., "Bachelor's", "Master's", or null). If you cannot extract the JSON reliably, just provide the full extracted text. Focus ONLY on the content from the image. Respond with ONLY the extracted text OR the JSON object.`,
              },
              {
                type: "image_url",
                image_url: {
                  // Use data URI format
                  "url": `data:${mimeType};base64,${base64Image}`,
                  // Optional: Detail setting ('low', 'high', 'auto') - 'high' might be better for text extraction but costs more
                  "detail": "high"
                },
              },
            ],
          },
        ],
        max_tokens: 2000, // Adjust token limit as needed
        temperature: 0.2, // Lower temperature for more deterministic text extraction
      });

      const messageContent = response.choices[0]?.message?.content;
      console.log('[API /uploadAndParseJD] OpenAI response received.');
      // console.log('Raw OpenAI response content:', messageContent); // For debugging

      if (!messageContent) {
        throw new Error("OpenAI returned an empty response.");
      }

      // Attempt to parse as JSON first, otherwise treat as plain text
      try {
          // Check if the response looks like JSON (simple check)
          if (messageContent.trim().startsWith('{') && messageContent.trim().endsWith('}')) {
              structuredData = JSON.parse(messageContent);
              // Optionally extract text from the structured data if needed elsewhere
              // For now, prioritize the structured data if available
              extractedText = `Job Title: ${structuredData.jobTitle || 'N/A'}\nRequired Skills: ${(structuredData.requiredSkills || []).join(', ')}\n... (extracted from JSON)`;
              console.log('[API /uploadAndParseJD] Parsed structured JSON data from OpenAI.');
          } else {
              extractedText = messageContent;
              console.log('[API /uploadAndParseJD] Received plain text from OpenAI.');
          }
      } catch (parseError) {
          console.warn('[API /uploadAndParseJD] OpenAI response was not valid JSON, treating as plain text.');
          extractedText = messageContent;
      }

    } catch (openaiError) {
      console.error("[API /uploadAndParseJD] Error calling OpenAI API:", openaiError);
       // Clean up the temporary file on OpenAI error
       await fs.unlink(filePath).catch(unlinkErr => console.error(`Error cleaning up temp file ${filePath}:`, unlinkErr));
      // Handle specific OpenAI errors if needed (e.g., billing, rate limits)
      return res.status(500).json({ success: false, message: `Failed to analyze image with OpenAI: ${openaiError.message}` });
    }

    // --- 6. Clean Up Temporary File ---
    try {
        await fs.unlink(filePath);
        console.log(`[API /uploadAndParseJD] Temporary file ${filePath} deleted successfully.`);
    } catch (unlinkError) {
        // Log the error but don't fail the request just because cleanup failed
        console.warn(`[API /uploadAndParseJD] Warning: Failed to delete temporary file ${filePath}:`, unlinkError.message);
    }

    // --- 7. Return Result ---
    console.log('[API /uploadAndParseJD] Processing successful. Returning result.');
    return res.status(200).json({
      success: true,
      message: "Job description image processed successfully.",
      extractedText: extractedText, // The full text extracted or derived
      structuredData: structuredData, // The parsed JSON object (or null)
      fileName: originalFilename,
    });

  } catch (error) {
    // Catch errors from formidable parsing or other synchronous issues
    console.error('[API /uploadAndParseJD] Error processing form data:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
       return res.status(413).json({ success: false, message: `Image file size exceeds limit (${formidableOptions.maxFileSize / 1024 / 1024}MB).` });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: "Invalid file type. Only images are allowed." });
    }
    return res.status(500).json({ success: false, message: `Server error processing upload: ${error.message}` });
  }
}