import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ApiKey } from "@/types/notes";

// Types for the notebook generation
export interface NotesStructure {
  title: string;
  sections: {
    heading: string;
    subsections: string[];
    imagePrompts: string[];
    imagePositions: number[];
  }[];
  totalImages: number;
  contentPrompt: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  position: number;
  base64Data: string;
  mimeType: string;
}

export interface NotebookContent {
  type: "text" | "image" | "heading" | "subheading";
  content: string;
  order: number;
  imageData?: string;
  mimeType?: string;
}

export interface GeneratedNotebook {
  id: string;
  title: string;
  structure: NotesStructure;
  content: NotebookContent[];
  createdAt: string;
  totalImages: number;
  wordCount: number;
}

// Helper function to get API key
const getApiKey = async (): Promise<string> => {
  const storedKey = await AsyncStorage.getItem("apiKey");
  if (!storedKey) {
    throw new Error(
      "No API key found. Please add your Gemini API key in Settings.",
    );
  }

  const apiKey: ApiKey = JSON.parse(storedKey);
  if (!apiKey.value) {
    throw new Error(
      "Invalid API key. Please check your Gemini API key in Settings.",
    );
  }

  return apiKey.value;
};

// Helper function to handle API errors
const handleApiError = (error: any): never => {
  console.error("Gemini API Error:", error);

  if (error instanceof Error) {
    if (
      error.message.includes("JSON Parse error") ||
      error.name === "SyntaxError"
    ) {
      throw new Error(
        "Received incomplete response from Gemini. Please try again.",
      );
    } else if (error.message.includes("API_KEY_INVALID")) {
      throw new Error(
        "Invalid API key. Please check your Gemini API key in Settings.",
      );
    } else if (
      error.message.includes("QUOTA_EXCEEDED") ||
      error.message.includes("429")
    ) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (error.message.includes("PERMISSION_DENIED")) {
      throw new Error(
        "Permission denied. Please check your API key permissions.",
      );
    } else if (
      error.message.includes("503") ||
      error.message.includes("UNAVAILABLE") ||
      error.message.includes("overloaded")
    ) {
      throw new Error(
        "Gemini servers are currently overloaded. Please try again in a few minutes.",
      );
    } else if (
      error.message.includes("500") ||
      error.message.includes("INTERNAL")
    ) {
      throw new Error("Gemini server error. Please try again later.");
    } else {
      throw error;
    }
  } else {
    throw new Error("An unexpected error occurred while generating content.");
  }
};

// Helper function to safely parse JSON with fallback
const safeJsonParse = (text: string): any => {
  console.log("Raw response length:", text?.length || 0);
  console.log("Raw response preview:", text?.substring(0, 200) || "EMPTY");

  // Check if response is empty or too short
  if (!text || text.trim().length < 10) {
    console.error("Response is empty or too short");
    throw new Error("Received empty response from Gemini. Please try again.");
  }

  try {
    // Clean up common issues
    const cleanedText = text
      .replace(/```json\n?|\n?```/g, "")
      .replace(/```\n?|\n?```/g, "")
      .trim();

    console.log("Cleaned text preview:", cleanedText.substring(0, 200));

    // Try to parse the cleaned text
    return JSON.parse(cleanedText);
  } catch (error) {
    console.warn("Initial JSON parse failed, attempting to fix:", error);
    console.log("Problematic text:", text.substring(0, 500));

    try {
      // Attempt to fix incomplete JSON
      let fixedText = text
        .replace(/```json\n?|\n?```/g, "")
        .replace(/```\n?|\n?```/g, "")
        .trim();

      // Try to complete incomplete JSON objects
      if (fixedText.endsWith(",")) {
        fixedText = fixedText.slice(0, -1);
      }

      // Count braces and try to close them
      const openBraces = (fixedText.match(/{/g) || []).length;
      const closeBraces = (fixedText.match(/}/g) || []).length;

      if (openBraces > closeBraces) {
        fixedText += "}".repeat(openBraces - closeBraces);
      }

      console.log("Fixed text preview:", fixedText.substring(0, 200));
      return JSON.parse(fixedText);
    } catch (fallbackError) {
      console.error("JSON parsing failed completely:", fallbackError);
      console.error("Final text that failed:", text);
      throw new Error(
        "Received malformed response from Gemini. Please try again.",
      );
    }
  }
};

// Fallback structure when JSON parsing fails
const createFallbackStructure = (prompt: string): NotesStructure => {
  return {
    title: `Notes: ${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}`,
    sections: [
      {
        heading: "Introduction",
        subsections: ["Overview", "Key Points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Main Content",
        subsections: ["Details", "Examples", "Analysis"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Summary",
        subsections: ["Key Takeaways", "Conclusion"],
        imagePrompts: [],
        imagePositions: [],
      },
    ],
    totalImages: 0,
    contentPrompt: `Create comprehensive notes about: ${prompt}`,
  };
};

// Helper function to retry API calls with exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isRetryableError =
        error.message?.includes("503") ||
        error.message?.includes("UNAVAILABLE") ||
        error.message?.includes("overloaded") ||
        error.message?.includes("500") ||
        error.message?.includes("INTERNAL");

      if (attempt === maxRetries || !isRetryableError) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(
        `Retry attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
};

// 1. Prompt Analysis and Notes Structure Generation
const analyzePromptAndGenerateStructure = async (
  prompt: string,
  uploadedFiles?: any[],
): Promise<NotesStructure> => {
  try {
    const apiKeyValue = await getApiKey();
    const genAI = new GoogleGenAI({ apiKey: apiKeyValue });

    const fileContext =
      uploadedFiles && uploadedFiles.length > 0
        ? `\n\nAdditional context from uploaded files: ${uploadedFiles.map((f) => f.name).join(", ")}`
        : "";

    const structurePrompt = `You are an expert note-taking analyst. Analyze the following prompt and create a comprehensive notes structure.

Prompt: ${prompt}${fileContext}

Return a JSON object with the following structure:
{
  "title": "Main title for the notes",
  "sections": [
    {
      "heading": "Section heading",
      "subsections": ["subsection1", "subsection2"],
      "imagePrompts": ["detailed image prompt 1", "detailed image prompt 2"],
      "imagePositions": [0, 2]
    }
  ],
  "totalImages": 3,
  "contentPrompt": "Detailed prompt for content generation based on this structure"
}

Guidelines:
- Create 3-5 main sections based on content complexity
- Each section should have 2-4 subsections
- Generate image prompts ONLY when they would enhance understanding (0-2 per section)
- Image prompts should be detailed and specific
- Position images strategically throughout the content
- Total images should be 0-5 based on content needs (0 if no visual aids needed)
- Content prompt should guide comprehensive content generation

IMPORTANT: Return ONLY a valid JSON object, no additional text, no explanations, no markdown formatting.`;

    const response = await retryWithBackoff(() =>
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: structurePrompt,
        config: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 3000,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        },
      }),
    );

    console.log("Structure response received:", !!response.text);
    console.log("Structure response length:", response.text?.length || 0);

    if (!response.text) {
      throw new Error("No structure generated. Please try a different prompt.");
    }

    // Use safe JSON parsing with fallback
    const parsedStructure = safeJsonParse(response.text);

    // Validate the parsed structure has required fields
    if (
      !parsedStructure.title ||
      !parsedStructure.sections ||
      !Array.isArray(parsedStructure.sections)
    ) {
      console.error("Invalid structure format:", parsedStructure);
      throw new Error("Invalid response format from Gemini. Please try again.");
    }

    console.log(
      "Successfully parsed structure with",
      parsedStructure.sections.length,
      "sections",
    );
    return parsedStructure;
  } catch (error) {
    console.warn("Structure generation failed, using fallback:", error);

    // If JSON parsing fails, use a simple fallback structure
    if (
      error instanceof Error &&
      (error.message.includes("malformed response") ||
        error.message.includes("empty response") ||
        error.message.includes("Invalid response format"))
    ) {
      console.log("Using fallback structure for prompt:", prompt);
      return createFallbackStructure(prompt);
    }

    return handleApiError(error);
  }
};

// 2. Image Generation
const generateImages = async (
  imagePrompts: string[],
): Promise<GeneratedImage[]> => {
  try {
    const apiKeyValue = await getApiKey();
    const genAI = new GoogleGenAI({ apiKey: apiKeyValue });

    const generatedImages: GeneratedImage[] = [];

    for (let i = 0; i < imagePrompts.length; i++) {
      const prompt = imagePrompts[i];

      const enhancedPrompt = `Create a high-quality, educational illustration for: ${prompt}.
      Style: Clean, modern, informative, suitable for educational notes.
      Avoid text overlays, keep it visually clear and professional.`;

      try {
        // Try using the image generation model first
        const response = await retryWithBackoff(() =>
          genAI.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: enhancedPrompt,
            config: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
              safetySettings: [
                {
                  category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
              ],
            },
          }),
        );

        // Check if response contains image data
        if (response.candidates && response.candidates[0]?.content?.parts) {
          const imagePart = response.candidates[0].content.parts.find((part) =>
            part.inlineData?.mimeType?.startsWith("image/"),
          );

          if (imagePart?.inlineData?.data) {
            generatedImages.push({
              id: `img_${Date.now()}_${i}`,
              prompt: prompt,
              position: i,
              base64Data: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
              mimeType: imagePart.inlineData.mimeType || "image/png",
            });
          } else {
            // Fallback to placeholder if no image data
            console.log(`No image data returned for prompt: ${prompt}`);
            generatedImages.push({
              id: `img_${Date.now()}_${i}`,
              prompt: prompt,
              position: i,
              base64Data: `placeholder_${i}`,
              mimeType: "image/placeholder",
            });
          }
        } else {
          // Fallback to placeholder
          generatedImages.push({
            id: `img_${Date.now()}_${i}`,
            prompt: prompt,
            position: i,
            base64Data: `placeholder_${i}`,
            mimeType: "image/placeholder",
          });
        }
      } catch (imageError) {
        console.warn(
          `Failed to generate image for prompt: ${prompt}`,
          imageError,
        );
        // Add placeholder even if generation fails
        generatedImages.push({
          id: `img_${Date.now()}_${i}`,
          prompt: prompt,
          position: i,
          base64Data: `placeholder_${i}`,
          mimeType: "image/placeholder",
        });
      }

      // Add delay between requests to avoid rate limiting
      if (i < imagePrompts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return generatedImages;
  } catch (error) {
    return handleApiError(error);
  }
};

// 3. Content Generation
const generateContent = async (
  structure: NotesStructure,
  generatedImages: GeneratedImage[],
): Promise<string> => {
  try {
    const apiKeyValue = await getApiKey();
    const genAI = new GoogleGenAI({ apiKey: apiKeyValue });

    const imageReferences =
      generatedImages.length > 0
        ? `\n\nAvailable images to reference:
${generatedImages.map((img, idx) => `Image ${idx + 1}: ${img.prompt}`).join("\n")}`
        : "";

    const contentPrompt = `You are an expert educational content creator. Generate comprehensive, well-structured notes based on the following structure.

Structure:
${JSON.stringify(structure, null, 2)}
${imageReferences}

Content Generation Guidelines:
- Create detailed, informative content for each section and subsection
- DO NOT use any markdown symbols (##, ###, *, -, etc.) - formatting is handled by the JSON structure
- Write plain text content only
- Use clear, educational language that flows naturally
- Include practical examples, key points, and detailed explanations
- Reference images naturally in the content when appropriate (e.g., "The diagram shows...")
- Write in paragraph form with natural breaks between ideas
- Target length: 1000-2000 words total
- Focus on substance and educational value rather than formatting

Generate clean, plain text content for each section now:`;

    const response = await retryWithBackoff(() =>
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contentPrompt,
        config: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 4096,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        },
      }),
    );

    if (!response.text) {
      throw new Error("No content generated. Please try again.");
    }

    // Validate content is not empty or malformed
    if (response.text.trim().length < 50) {
      throw new Error(
        "Received incomplete content from Gemini. Please try again.",
      );
    }

    return response.text;
  } catch (error) {
    return handleApiError(error);
  }
};

// Parse content into structured format
const parseContentToStructure = (
  content: string,
  images: GeneratedImage[],
  structure: NotesStructure,
): NotebookContent[] => {
  const lines = content.split("\n");
  const structuredContent: NotebookContent[] = [];
  let order = 0;
  let imageIndex = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue;

    // Check if line matches section headings from structure
    const isMainHeading = structure.sections.some((section) =>
      trimmedLine.toLowerCase().includes(section.heading.toLowerCase()),
    );

    const isSubHeading = structure.sections.some((section) =>
      section.subsections.some((sub) =>
        trimmedLine.toLowerCase().includes(sub.toLowerCase()),
      ),
    );

    if (isMainHeading) {
      structuredContent.push({
        type: "heading",
        content: trimmedLine,
        order: order++,
      });
    } else if (isSubHeading) {
      structuredContent.push({
        type: "subheading",
        content: trimmedLine,
        order: order++,
      });
    } else if (trimmedLine.length > 0) {
      structuredContent.push({
        type: "text",
        content: trimmedLine,
        order: order++,
      });

      // Insert image after certain content blocks
      if (imageIndex < images.length && Math.random() > 0.7) {
        const image = images[imageIndex];
        structuredContent.push({
          type: "image",
          content: image.prompt,
          order: order++,
          imageData: image.base64Data,
          mimeType: image.mimeType,
        });
        imageIndex++;
      }
    }
  }

  // Add remaining images at the end
  while (imageIndex < images.length) {
    const image = images[imageIndex];
    structuredContent.push({
      type: "image",
      content: image.prompt,
      order: order++,
      imageData: image.base64Data,
      mimeType: image.mimeType,
    });
    imageIndex++;
  }

  return structuredContent;
};

// Main integrated notebook generation function
export const generateNotebook = async (
  prompt: string,
  uploadedFiles?: any[],
  onProgress?: (step: string) => void,
): Promise<GeneratedNotebook> => {
  try {
    // Step 1: Analyze prompt and generate structure
    const step1 = "Analyzing prompt and generating structure...";
    console.log("Step 1:", step1);
    onProgress?.(step1);
    const structure = await analyzePromptAndGenerateStructure(
      prompt,
      uploadedFiles,
    );

    // Step 2: Generate images based on the structure (only if needed)
    const allImagePrompts = structure.sections.flatMap(
      (section) => section.imagePrompts,
    );

    let images: GeneratedImage[] = [];
    if (allImagePrompts.length > 0) {
      const step2 = `Generating ${allImagePrompts.length} images...`;
      console.log("Step 2:", step2);
      onProgress?.(step2);
      images = await generateImages(allImagePrompts);
    } else {
      onProgress?.("No images needed for this content...");
    }

    // Step 3: Generate content based on structure
    const step3 = "Generating comprehensive content...";
    console.log("Step 3:", step3);
    onProgress?.(step3);
    const rawContent = await generateContent(structure, images);

    // Step 4: Parse content into structured format
    const step4 = "Structuring and formatting content...";
    console.log("Step 4:", step4);
    onProgress?.(step4);
    const structuredContent = parseContentToStructure(
      rawContent,
      images,
      structure,
    );

    // Step 5: Create final notebook object
    onProgress?.("Finalizing notebook...");
    const notebook: GeneratedNotebook = {
      id: `notebook_${Date.now()}`,
      title: structure.title,
      structure,
      content: structuredContent,
      createdAt: new Date().toISOString(),
      totalImages: images.length,
      wordCount: rawContent.split(/\s+/).filter((word) => word.length > 0)
        .length,
    };

    console.log("Notebook generation completed successfully!");
    onProgress?.("Generation completed!");
    return notebook;
  } catch (error) {
    console.error("Error in notebook generation:", error);
    return handleApiError(error);
  }
};

// Refine existing notebook function
export const refineNotebook = async (
  notebook: GeneratedNotebook,
  refinementRequest?: string,
  onProgress?: (step: string) => void,
): Promise<GeneratedNotebook> => {
  try {
    onProgress?.("Analyzing current notes for refinement...");

    const apiKeyValue = await getApiKey();
    const genAI = new GoogleGenAI({ apiKey: apiKeyValue });

    // Extract current content as text for analysis
    const currentContentText = notebook.content
      .map((item) => {
        switch (item.type) {
          case "heading":
            return `HEADING: ${item.content}`;
          case "subheading":
            return `SUBHEADING: ${item.content}`;
          case "text":
            return item.content;
          case "image":
            return `IMAGE: ${item.content}`;
          default:
            return item.content;
        }
      })
      .join("\n");

    const refinementPrompt = `You are an expert content editor and educational specialist. Your task is to refine and improve the following notes while maintaining their structure and core information.

ORIGINAL NOTEBOOK:
Title: ${notebook.title}
Content:
${currentContentText}

REFINEMENT REQUEST: ${refinementRequest || "General improvement - make the content clearer, more comprehensive, and better structured"}

INSTRUCTIONS:
1. ${refinementRequest ? "Focus on the specific request above while maintaining overall structure" : "Keep the same overall structure and heading organization"}
2. ${refinementRequest ? "Keep the same heading organization unless the request specifically asks to change it" : "Improve clarity, readability, and educational value"}
3. ${refinementRequest ? "Add or improve content based on the user's specific needs" : "Add more detailed explanations where needed"}
4. ${refinementRequest ? "If adding new sections/topics, integrate them naturally into existing structure" : "Ensure information flows logically"}
5. Maintain all existing image references and descriptions
6. DO NOT use markdown formatting (##, ###, *, -, etc.)
7. Return only plain text content with natural paragraph breaks
8. ${refinementRequest ? "Ensure new content is accurate, relevant, and well-explained" : "Focus on enhancing understanding and retention"}
9. ${refinementRequest ? "If examples are requested, provide practical, real-world examples" : "Add practical examples and applications where appropriate"}
10. ${refinementRequest ? "If clarification is requested, break down complex concepts step-by-step" : "Ensure content is accurate and well-explained"}

Generate the refined content now, ${refinementRequest ? "addressing the specific refinement request while maintaining the overall structure" : "maintaining the same structure but with improved quality and clarity"}:`;

    onProgress?.("Generating refined content...");

    const response = await retryWithBackoff(() =>
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: refinementPrompt,
        config: {
          temperature: 0.6,
          topK: 1,
          topP: 0.9,
          maxOutputTokens: 4096,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        },
      }),
    );

    if (!response.text) {
      throw new Error("No refined content generated. Please try again.");
    }

    // Validate content is not empty or malformed
    if (response.text.trim().length < 50) {
      throw new Error(
        "Received incomplete refined content from Gemini. Please try again.",
      );
    }

    onProgress?.("Processing refined content...");

    // Parse the refined content while preserving existing images
    const existingImages = notebook.content
      .filter((item) => item.type === "image")
      .map((item, index) => ({
        id: `img_refined_${Date.now()}_${index}`,
        prompt: item.content,
        position: index,
        base64Data: item.imageData || `placeholder_${index}`,
        mimeType: item.mimeType || "image/placeholder",
      }));

    const refinedStructuredContent = parseContentToStructure(
      response.text,
      existingImages,
      notebook.structure,
    );

    onProgress?.("Finalizing refined notebook...");

    // Create refined notebook with updated content
    const refinedNotebook: GeneratedNotebook = {
      id: `notebook_refined_${Date.now()}`,
      title: notebook.title,
      structure: notebook.structure,
      content: refinedStructuredContent,
      createdAt: new Date().toISOString(),
      totalImages: existingImages.length,
      wordCount: response.text.split(/\s+/).filter((word) => word.length > 0)
        .length,
    };

    console.log("Notebook refinement completed successfully!");
    onProgress?.("Refinement completed!");
    return refinedNotebook;
  } catch (error) {
    console.error("Error in notebook refinement:", error);
    return handleApiError(error);
  }
};
