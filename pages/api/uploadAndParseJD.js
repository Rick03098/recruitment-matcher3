// pages/api/uploadAndParseJD.js
import { formidable } from 'formidable';
import fs from 'fs/promises';
import OpenAI from 'openai';

// --- OpenAI Client Initialization ---
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
export const config = {
  api: {
    bodyParser: false,
  },
};

const formidableOptions = {
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    filter: function ({ name, originalFilename, mimetype }) {
        const allowed = mimetype && mimetype.startsWith('image/');
        if (!allowed) {
            console.warn(`[API /uploadAndParseJD] Rejected file upload: ${originalFilename} (type: ${mimetype}). Only images are allowed.`);
        }
        return allowed;
    },
    // uploadDir: '/tmp', // Vercel usually uses /tmp by default
};
// --- Configuration End ---

// --- API Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed. Use POST.` });
  }

  if (!openai) {
    return res.status(500).json({ success: false, message: "OpenAI service configuration error." });
  }

  console.log('[API /uploadAndParseJD] Received POST request. Processing with event-based formidable...');

  // --- Use Promise to wrap formidable event handling ---
  await new Promise((resolve, reject) => {
    const form = formidable(formidableOptions);
    let fields = {};
    let files = {};
    let tempFilePath = null; // For cleanup

    form.on('field', (fieldName, value) => {
        console.log(`[API /uploadAndParseJD] Received field: ${fieldName}`);
        fields[fieldName] = value;
    });

    form.on('file', (fieldName, file) => {
        console.log(`[API /uploadAndParseJD] Received file: ${fieldName}, Original Name: ${file.originalFilename}, Temp Path: ${file.filepath}`);
        if (fieldName === 'jobFile') {
            if (!files[fieldName]) {
                 files[fieldName] = [];
            }
            files[fieldName].push(file);
            tempFilePath = file.filepath; // Keep track for cleanup
        } else {
             console.warn(`[API /uploadAndParseJD] Received unexpected file field: ${fieldName}`);
             fs.unlink(file.filepath).catch(err => console.error(`Error removing unexpected file ${file.filepath}:`, err));
        }
    });

    form.on('error', (err) => {
        console.error('[API /uploadAndParseJD] Formidable parsing error:', err);
        if (tempFilePath) {
             fs.unlink(tempFilePath).catch(unlinkErr => console.error(`Error cleaning up temp file ${tempFilePath} after formidable error:`, unlinkErr));
        }
        reject({ statusCode: 500, message: `Error parsing form data: ${err.message}`, internalError: err });
    });

    form.on('end', async () => {
        console.log('[API /uploadAndParseJD] Formidable parsing ended.');
        try {
            const uploadedFile = files.jobFile?.[0];

            if (!uploadedFile) {
                console.error("[API /uploadAndParseJD] No file found with field name 'jobFile'. Files received:", files);
                return reject({ statusCode: 400, message: "No image file uploaded or incorrect field name used ('jobFile' expected)." });
            }

            // --- File processing and OpenAI call ---
            const originalFilename = uploadedFile.originalFilename;
            const mimeType = uploadedFile.mimetype;
            let base64Image;

            try {
                const imageBuffer = await fs.readFile(tempFilePath);
                base64Image = imageBuffer.toString('base64');
                console.log(`[API /uploadAndParseJD] Image file read and converted to Base64.`);
            } catch (readError) {
                console.error(`[API /uploadAndParseJD] Error reading file ${tempFilePath}:`, readError);
                throw new Error('Error reading uploaded image file.');
            }

            let extractedText = '';
            let structuredData = null;

            try {
                console.log('[API /uploadAndParseJD] Sending image to OpenAI with improved prompt...');
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // Or "gpt-4o"
                    messages: [
                     {
                       role: "user",
                       content: [
                         {
                           type: "text",
                           // ----- IMPROVED PROMPT -----
                           text: `Analyze the following job description image. Extract the full text accurately. Then, based on the extracted text, provide a JSON object containing the key requirements. The JSON object MUST have these exact keys:
- "jobTitle": string (The specific job position being advertised, like "Software Engineer" or "Product Manager". If no specific position is clearly mentioned for these requirements, return null. Do not extract recruitment slogans like "招贤纳仕" or similar as the job title.)
- "requiredSkills": array of strings (Extract ALL items listed explicitly under a heading like '技能要求', '任职要求', 'Requirements', etc. Ensure every numbered or listed item in that specific section is included in the array, trying to keep original wording.)
- "preferredSkills": array of strings (List any skills explicitly mentioned as preferred, optional, '加分项' or 'nice to have'. If none, return an empty array.)
- "yearsExperience": string (Extract required years of experience, e.g., "3-5 years", "5+", or null if not mentioned.)
- "educationLevel": string (Extract minimum education level required, e.g., "Bachelor's", "Master's", "本科", "硕士", or null if not mentioned.)

If you cannot reliably extract the JSON structure, respond with ONLY the full extracted text from the image. Otherwise, respond ONLY with the valid JSON object. Focus ONLY on the content derived from the image.`,
                           // ----- END IMPROVED PROMPT -----
                         },
                         {
                           type: "image_url",
                           image_url: {
                             "url": `data:${mimeType};base64,${base64Image}`,
                             "detail": "high" // Use "high" detail for better OCR on text-heavy images
                           },
                         },
                       ],
                     },
                    ],
                    max_tokens: 2000, // Might need adjustment based on JD length
                    temperature: 0.1, // Keep low temperature for accuracy
                });

                const messageContent = response.choices[0]?.message?.content;
                console.log('[API /uploadAndParseJD] OpenAI response received.');
                // console.log('[API /uploadAndParseJD] Raw OpenAI response content:', messageContent); // Uncomment for deep debugging

                if (!messageContent) {
                    throw new Error("OpenAI analysis returned no content.");
                }

                // Attempt to parse as JSON first, otherwise treat as plain text
                try {
                   // Trim whitespace and check if it looks like a JSON object
                   const trimmedContent = messageContent.trim();
                   if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
                       structuredData = JSON.parse(trimmedContent);
                       // Generate a summary text fallback from structured data
                       extractedText = `Job Title: ${structuredData.jobTitle || 'N/A'}\nRequired Skills: ${(structuredData.requiredSkills || []).join(', ')}\n... (extracted from JSON)`;
                       console.log('[API /uploadAndParseJD] Parsed structured JSON data from OpenAI.');
                   } else {
                       extractedText = messageContent; // Use the raw text if not JSON
                       console.log('[API /uploadAndParseJD] Received plain text from OpenAI.');
                   }
                } catch (parseError) {
                   console.warn('[API /uploadAndParseJD] OpenAI response was not valid JSON, treating as plain text. Error:', parseError.message);
                   console.warn('[API /uploadAndParseJD] Content that failed JSON parsing:', messageContent);
                   extractedText = messageContent; // Keep the raw text
                   structuredData = null;
                }

            } catch (openaiError) {
                console.error("[API /uploadAndParseJD] Error calling OpenAI API:", openaiError);
                throw new Error(`Failed to analyze image with OpenAI: ${openaiError.message}`);
            }

            // Resolve the promise with the successful result
            resolve({
                 success: true,
                 message: "Job description image processed successfully.",
                 extractedText: extractedText,
                 structuredData: structuredData,
                 fileName: originalFilename,
            });

        } catch (processingError) {
             // Catch errors from file reading or OpenAI call within 'end' handler
             console.error('[API /uploadAndParseJD] Error during file processing/OpenAI call:', processingError);
             reject({ statusCode: 500, message: processingError.message || "Server error during processing." });
        } finally {
             // Ensure cleanup happens after processing in 'end' or if an error occurred within 'end'
             if (tempFilePath) {
                 await fs.unlink(tempFilePath).then(() => {
                     console.log(`[API /uploadAndParseJD] Temporary file ${tempFilePath} deleted successfully in 'end' finally.`);
                 }).catch(unlinkErr => {
                     console.warn(`[API /uploadAndParseJD] Warning: Failed to delete temporary file ${tempFilePath} in 'end' finally:`, unlinkErr.message);
                 });
                 tempFilePath = null; // Mark as cleaned
             }
        }
    });

    // Start parsing the request
    form.parse(req);

  })
  .then(result => {
      // Promise resolved successfully
      res.status(200).json(result);
  })
  .catch(errorInfo => {
      // Promise was rejected
      const statusCode = errorInfo.statusCode || 500;
      const message = errorInfo.message || "Unknown server error during upload.";
      if (errorInfo.internalError) {
          console.error("[API /uploadAndParseJD] Internal error detail:", errorInfo.internalError);
      }
      res.status(statusCode).json({ success: false, message: message });
  });
}