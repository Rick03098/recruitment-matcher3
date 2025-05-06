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

  // Declare variables outside the try block if needed in catch/finally for cleanup
  let tempFilePath = null;

  try {
    // --- 2a. Parse Form Data and Add Debug Logging ---
    console.log('[API /uploadAndParseJD] Attempting form.parse...');
    const parseResult = await form.parse(req);
    // DEBUGGING: Log the raw result from form.parse
    console.log('[API /uploadAndParseJD] form.parse resolved with:', parseResult);
    console.log('[API /uploadAndParseJD] Type of parseResult:', typeof parseResult);
    console.log('[API /uploadAndParseJD] Is parseResult an array?', Array.isArray(parseResult));
    // --- Debug Logging End ---

    // --- 2b. Add Check for Expected Structure ---
    if (!Array.isArray(parseResult) || parseResult.length < 2) {
         console.error('[API /uploadAndParseJD] Error: form.parse did not return the expected [fields, files] array structure.');
         // Log the problematic value for more insight
         console.error('[API /uploadAndParseJD] Actual parseResult:', parseResult);
         throw new Error('Internal server error: Unexpected form parsing result.'); // Throw error to be caught below
    }
    // --- Check End ---

    // --- 2c. Safely Destructure ---
    const [fields, files] = parseResult;
    console.log('[API /uploadAndParseJD] Successfully destructured fields and files.');
    // --- Destructuring End ---


    // --- 3. Get Uploaded File ---
    const uploadedFile = files.jobFile?.[0]; // Assuming frontend sends file with key 'jobFile'

    if (!uploadedFile) {
      console.error("[API /uploadAndParseJD] No file found in the request (expected key 'jobFile'). Files object:", files);
      // Attempt to log field names if file is missing
      console.error("[API /uploadAndParseJD] Received fields:", fields);
      return res.status(400).json({ success: false, message: "No image file uploaded or incorrect field name used ('jobFile' expected)." });
    }

    // Store the temp path for potential cleanup in catch/finally
    tempFilePath = uploadedFile.filepath;
    const originalFilename = uploadedFile.originalFilename;
    const mimeType = uploadedFile.mimetype;
    console.log(`[API /uploadAndParseJD] File received: ${originalFilename} (${mimeType}), Temp path: ${tempFilePath}`);

    // --- 4. Read File and Convert to Base64 ---
    let base64Image;
    try {
      const imageBuffer = await fs.readFile(tempFilePath);
      base64Image = imageBuffer.toString('base64');
      console.log(`[API /uploadAndParseJD] Image file read and converted to Base64 (length: ${base64Image.length})`);
    } catch (readError) {
        console.error(`[API /uploadAndParseJD] Error reading file ${tempFilePath}:`, readError);
        // No need to manually cleanup here, the main catch block's finally will handle it
        throw new Error('Error reading uploaded image file.'); // Re-throw to be caught by main catch
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

      if (!messageContent) {
        // Treat empty response as an error
        console.error("[API /uploadAndParseJD] OpenAI returned an empty response content.");
        throw new Error("OpenAI analysis returned no content.");
      }

      // Attempt to parse as JSON first, otherwise treat as plain text
      try {
          if (messageContent.trim().startsWith('{') && messageContent.trim().endsWith('}')) {
              structuredData = JSON.parse(messageContent);
              extractedText = `Job Title: ${structuredData.jobTitle || 'N/A'}\nRequired Skills: ${(structuredData.requiredSkills || []).join(', ')}\n... (extracted from JSON)`; // Create a summary text
              console.log('[API /uploadAndParseJD] Parsed structured JSON data from OpenAI.');
          } else {
              extractedText = messageContent;
              console.log('[API /uploadAndParseJD] Received plain text from OpenAI.');
          }
      } catch (parseError) {
          console.warn('[API /uploadAndParseJD] OpenAI response was not valid JSON, treating as plain text. Error:', parseError.message);
          // Log the content that failed to parse
          console.warn('[API /uploadAndParseJD] Content that failed JSON parsing:', messageContent);
          extractedText = messageContent; // Keep the raw text
          structuredData = null; // Ensure structuredData is null
      }

    } catch (openaiError) {
      console.error("[API /uploadAndParseJD] Error calling OpenAI API:", openaiError);
       // Re-throw to be caught by the main catch block (which handles cleanup)
      throw new Error(`Failed to analyze image with OpenAI: ${openaiError.message}`);
    }

    // --- 6. Clean Up Temporary File (Moved to finally block below) ---
    // We will attempt cleanup regardless of success after OpenAI call

    // --- 7. Return Result ---
    console.log('[API /uploadAndParseJD] Processing successful. Returning result.');
    // Attempt cleanup before sending success response
    if (tempFilePath) {
        await fs.unlink(tempFilePath).then(() => {
            console.log(`[API /uploadAndParseJD] Temporary file ${tempFilePath} deleted successfully.`);
            tempFilePath = null; // Mark as deleted
        }).catch(unlinkError => {
            console.warn(`[API /uploadAndParseJD] Warning: Failed to delete temporary file ${tempFilePath}:`, unlinkError.message);
            // Continue without failing the request
        });
    }
    return res.status(200).json({
      success: true,
      message: "Job description image processed successfully.",
      extractedText: extractedText,
      structuredData: structuredData,
      fileName: originalFilename,
    });

  } catch (error) {
    // --- Catch Block for All Errors (including form parse, file read, OpenAI, etc.) ---
    console.error('[API /uploadAndParseJD] Overall error handler caught an error:', error);

    let statusCode = 500;
    let message = `Server error processing upload: ${error.message}`;

    // Customize response based on known error codes from formidable
    if (error.code === 'LIMIT_FILE_SIZE') {
       statusCode = 413; // Payload Too Large
       message = `Image file size exceeds limit (${formidableOptions.maxFileSize / 1024 / 1024}MB).`;
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = 400; // Bad Request
        message = "Invalid file type. Only images are allowed.";
    } else if (message.includes("form.parse did not return")) {
        // Keep the specific message for the structure error
        statusCode = 500;
    }
    // Add more specific error handling if needed

    // --- Ensure Cleanup Attempt in Case of Error ---
    if (tempFilePath) {
        console.log(`[API /uploadAndParseJD] Attempting cleanup of temp file due to error: ${tempFilePath}`);
        await fs.unlink(tempFilePath).then(() => {
             console.log(`[API /uploadAndParseJD] Temp file ${tempFilePath} deleted successfully after error.`);
        }).catch(unlinkErr => {
            console.error(`[API /uploadAndParseJD] Error cleaning up temp file ${tempFilePath} after error:`, unlinkErr.message);
        });
    }

    return res.status(statusCode).json({
      success: false,
      message: message // Use the determined message
    });
    // --- Error Handling End ---
  }
}