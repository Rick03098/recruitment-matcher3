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

    // Listener for fields
    form.on('field', (fieldName, value) => {
        console.log(`[API /uploadAndParseJD] Received field: ${fieldName}`);
        // Handle fields if necessary, e.g., accumulate if multiple fields with same name allowed
        fields[fieldName] = value;
    });

    // Listener for files
    form.on('file', (fieldName, file) => {
        console.log(`[API /uploadAndParseJD] Received file: ${fieldName}, Original Name: ${file.originalFilename}, Temp Path: ${file.filepath}`);
        // Store file info, assuming only one file named 'jobFile'
        if (fieldName === 'jobFile') {
            if (!files[fieldName]) {
                 files[fieldName] = [];
            }
            files[fieldName].push(file);
            tempFilePath = file.filepath; // Keep track for cleanup
        } else {
             console.warn(`[API /uploadAndParseJD] Received unexpected file field: ${fieldName}`);
             // Optionally delete unexpected files immediately
             fs.unlink(file.filepath).catch(err => console.error(`Error removing unexpected file ${file.filepath}:`, err));
        }
    });

    // Listener for errors during parsing
    form.on('error', (err) => {
        console.error('[API /uploadAndParseJD] Formidable parsing error:', err);
        // Ensure cleanup happens even if parsing fails mid-way
        if (tempFilePath) {
             fs.unlink(tempFilePath).catch(unlinkErr => console.error(`Error cleaning up temp file ${tempFilePath} after formidable error:`, unlinkErr));
        }
        reject({ statusCode: 500, message: `Error parsing form data: ${err.message}`, internalError: err }); // Reject the promise
    });

    // Listener for when parsing is complete
    form.on('end', async () => {
        console.log('[API /uploadAndParseJD] Formidable parsing ended.');
        try {
            const uploadedFile = files.jobFile?.[0];

            if (!uploadedFile) {
                console.error("[API /uploadAndParseJD] No file found with field name 'jobFile'. Files received:", files);
                // Reject the promise if the expected file is missing
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
                // Propagate error for cleanup and rejection
                throw new Error('Error reading uploaded image file.');
            }

            let extractedText = '';
            let structuredData = null;

            try {
                console.log('[API /uploadAndParseJD] Sending image to OpenAI...');
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // Or gpt-4o
                    messages: [ /* ... (Keep the same messages array as before) ... */
                     {
                       role: "user",
                       content: [
                         {
                           type: "text",
                           text: `Analyze the following job description image. Extract the full text accurately. Then, based on the extracted text, provide a JSON object containing the key requirements. The JSON object should have keys: "jobTitle" (string), "requiredSkills" (array of strings), "preferredSkills" (array of strings), "yearsExperience" (string, e.g., "3-5 years", "5+", or null), "educationLevel" (string, e.g., "Bachelor's", "Master's", or null). If you cannot extract the JSON reliably, just provide the full extracted text. Focus ONLY on the content from the image. Respond with ONLY the extracted text OR the JSON object.`,
                         },
                         {
                           type: "image_url",
                           image_url: {
                             "url": `data:${mimeType};base64,${base64Image}`,
                             "detail": "high"
                           },
                         },
                       ],
                     },
                    ],
                    max_tokens: 2000,
                    temperature: 0.2,
                });

                const messageContent = response.choices[0]?.message?.content;
                console.log('[API /uploadAndParseJD] OpenAI response received.');

                if (!messageContent) {
                    throw new Error("OpenAI analysis returned no content.");
                }

                try {
                   if (messageContent.trim().startsWith('{') && messageContent.trim().endsWith('}')) {
                       structuredData = JSON.parse(messageContent);
                       extractedText = `Job Title: ${structuredData.jobTitle || 'N/A'}\nRequired Skills: ${(structuredData.requiredSkills || []).join(', ')}\n... (extracted from JSON)`;
                       console.log('[API /uploadAndParseJD] Parsed structured JSON data from OpenAI.');
                   } else {
                       extractedText = messageContent;
                       console.log('[API /uploadAndParseJD] Received plain text from OpenAI.');
                   }
                } catch (parseError) {
                   console.warn('[API /uploadAndParseJD] OpenAI response was not valid JSON, treating as plain text. Error:', parseError.message);
                   console.warn('[API /uploadAndParseJD] Content that failed JSON parsing:', messageContent);
                   extractedText = messageContent;
                   structuredData = null;
                }

            } catch (openaiError) {
                console.error("[API /uploadAndParseJD] Error calling OpenAI API:", openaiError);
                // Propagate OpenAI errors
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
             reject({ statusCode: 500, message: processingError.message || "Server error during processing." }); // Reject the promise
        } finally {
             // Ensure cleanup happens after processing in 'end' or if an error occurred within 'end'
             if (tempFilePath) {
                 await fs.unlink(tempFilePath).then(() => {
                     console.log(`[API /uploadAndParseJD] Temporary file ${tempFilePath} deleted successfully in 'end' finally.`);
                 }).catch(unlinkErr => {
                     console.warn(`[API /uploadAndParseJD] Warning: Failed to delete temporary file ${tempFilePath} in 'end' finally:`, unlinkErr.message);
                 });
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
      // Promise was rejected (either from 'error' event or explicit reject in 'end')
      const statusCode = errorInfo.statusCode || 500;
      const message = errorInfo.message || "Unknown server error during upload.";
      // Log the internal error if present
      if (errorInfo.internalError) {
          console.error("[API /uploadAndParseJD] Internal error detail:", errorInfo.internalError);
      }
      res.status(statusCode).json({ success: false, message: message });
  });
}