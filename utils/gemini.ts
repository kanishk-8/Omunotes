import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ApiKey } from "@/types/notes";

// Configuration constants
const IMAGE_GENERATION_CONFIG = {
  MAX_IMAGES_PER_NOTEBOOK: 5,
  MAX_IMAGES_PER_SECTION: 2,
  DELAY_BETWEEN_IMAGES_MS: 3000,
  ENABLE_QUOTA_PROTECTION: true,
};

// Types for the notebook generation
export interface NotesStructure {
  title: string;
  sections: {
    heading: string;
    subsections: string[];
    contentTypes: string[];
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
  type: "text" | "image" | "heading" | "subheading" | "points" | "code";
  content: string;
  order: number;
  imageData?: string;
  mimeType?: string;
  language?: string;
  points?: string[];
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
      error.message.includes("exceeded your current quota") ||
      error.message.includes("RESOURCE_EXHAUSTED") ||
      error.message.includes("429")
    ) {
      throw new Error(
        "API quota exceeded. Please try again later or upgrade your Gemini API plan.",
      );
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
  // Extract key topics from the prompt for better structure
  const cleanPrompt = prompt.toLowerCase().trim();
  let mainTopic = "General Topic";
  let sections = [];

  // Try to identify the main subject
  if (
    cleanPrompt.includes("explain") ||
    cleanPrompt.includes("what is") ||
    cleanPrompt.includes("define")
  ) {
    mainTopic = prompt.substring(0, 60);
    sections = [
      {
        heading: "Definition and Overview",
        subsections: ["Basic Concepts", "Key Terms", "Background Information"],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Detailed Explanation",
        subsections: ["Core Principles", "How It Works", "Important Features"],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Examples and Applications",
        subsections: [
          "Real-world Examples",
          "Use Cases",
          "Practical Applications",
        ],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
    ];
  } else if (
    cleanPrompt.includes("compare") ||
    cleanPrompt.includes("difference") ||
    cleanPrompt.includes("vs")
  ) {
    mainTopic = prompt.substring(0, 60);
    sections = [
      {
        heading: "Introduction to Comparison",
        subsections: ["Overview", "Context"],
        contentTypes: ["paragraph"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Key Differences",
        subsections: [
          "Major Distinctions",
          "Comparative Analysis",
          "Pros and Cons",
        ],
        contentTypes: ["points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Conclusion",
        subsections: [
          "Summary of Differences",
          "Which to Choose",
          "Final Thoughts",
        ],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
    ];
  } else if (
    cleanPrompt.includes("code") ||
    cleanPrompt.includes("programming") ||
    cleanPrompt.includes("tutorial") ||
    cleanPrompt.includes("how to")
  ) {
    mainTopic = prompt.substring(0, 60);
    sections = [
      {
        heading: "Introduction",
        subsections: ["Overview", "Prerequisites", "What You'll Learn"],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Step-by-Step Guide",
        subsections: ["Setup", "Implementation", "Examples"],
        contentTypes: ["points", "code"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Advanced Topics",
        subsections: ["Best Practices", "Common Issues", "Optimization"],
        contentTypes: ["paragraph", "points", "code"],
        imagePrompts: [],
        imagePositions: [],
      },
    ];
  } else {
    // Default comprehensive structure
    mainTopic = prompt.substring(0, 60);
    sections = [
      {
        heading: "Introduction",
        subsections: ["Overview", "Background", "Importance"],
        contentTypes: ["paragraph"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Core Content",
        subsections: ["Key Points", "Detailed Information", "Analysis"],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Practical Aspects",
        subsections: ["Examples", "Applications", "Implementation"],
        contentTypes: ["paragraph", "points"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Summary",
        subsections: ["Key Takeaways", "Conclusion", "Next Steps"],
        contentTypes: ["points"],
        imagePrompts: [],
        imagePositions: [],
      },
    ];
  }

  return {
    title: `Notes: ${mainTopic}${prompt.length > 60 ? "..." : ""}`,
    sections: sections,
    totalImages: 0,
    contentPrompt: `Create comprehensive educational notes about: ${prompt}. Focus on clear explanations, practical examples, and structured learning content.`,
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

    const structurePrompt = `You are an expert note-taking analyst. Analyze the following prompt and create a comprehensive notes structure with intelligent content formatting.

Prompt: ${prompt}${fileContext}

Return a JSON object with the following structure:
{
  "title": "Main title for the notes",
  "sections": [
    {
      "heading": "Section heading",
      "subsections": ["subsection1", "subsection2"],
      "contentTypes": ["paragraph", "points", "code"],
      "imagePrompts": ["detailed image prompt 1", "detailed image prompt 2"],
      "imagePositions": [0, 2]
    }
  ],
  "totalImages": 5,
  "contentPrompt": "Detailed prompt for content generation based on this structure",
  "preferredFormat": "mixed"
}

Content Analysis Guidelines:
- Analyze if the topic benefits from point-based format (tutorials, lists, step-by-step guides, comparisons, features, benefits, etc.)
- Detect if code examples are needed (programming, technical topics, configuration, commands, etc.)
- Create 3-6 main sections based on content complexity (NO LIMITS)
- Each section should have 2-5 subsections
- Generate image prompts when they would enhance understanding (0-3 per section)
- Image prompts should be detailed and specific
- Position images strategically throughout the content
- Total images should be 0-${IMAGE_GENERATION_CONFIG.MAX_IMAGES_PER_NOTEBOOK} based on content needs (MAX ${IMAGE_GENERATION_CONFIG.MAX_IMAGES_PER_NOTEBOOK} to avoid quota issues)
- Content prompt should guide comprehensive, unlimited content generation
- Specify contentTypes for each section: "paragraph" for flowing text, "points" for lists/steps, "code" for technical examples

Format Detection Rules:
- Use "points" for: tutorials, how-to guides, lists of features/benefits, step-by-step processes, comparisons, key takeaways
- Use "code" for: programming tutorials, technical documentation, configuration examples, command references
- Use "paragraph" for: explanatory content, theoretical concepts, detailed descriptions, narratives
- Use "mixed" for comprehensive topics that need all formats

IMPORTANT: Return ONLY a valid JSON object, no additional text, no explanations, no markdown formatting.`;

    const response = await retryWithBackoff(() =>
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: structurePrompt,
        config: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 4000,
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

    // Limit to maximum configured images to avoid quota issues
    const limitedPrompts = imagePrompts.slice(
      0,
      IMAGE_GENERATION_CONFIG.MAX_IMAGES_PER_NOTEBOOK,
    );
    let quotaExhausted = false;

    for (let i = 0; i < limitedPrompts.length; i++) {
      const prompt = limitedPrompts[i];

      // Skip remaining images if quota was exhausted
      if (quotaExhausted) {
        console.log(`Skipping remaining images due to quota exhaustion`);
        break;
      }

      // Enhanced prompt following Gemini best practices for educational illustrations
      const enhancedPrompt = `Create a high-quality educational illustration showing ${prompt}.

The image should be a clean, modern diagram with the following characteristics:
- Professional, academic style suitable for educational materials
- Clear visual hierarchy with well-organized information
- Minimal but legible text labels where necessary
- Good contrast and readability with a clean background
- Informative visual elements that enhance understanding
- Modern flat design aesthetic with appropriate use of color
- Suitable for inclusion in educational notes and study materials

Style: Clean vector illustration, educational infographic style, professional appearance.`;

      try {
        console.log(
          `Generating image ${i + 1}/${limitedPrompts.length}: ${prompt}`,
        );

        const response = await retryWithBackoff(() =>
          genAI.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: [{ text: enhancedPrompt }],
            config: {
              temperature: 0.8,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
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

        console.log(`Image generation response received for prompt ${i + 1}`);

        // Check if response contains parts
        if (response?.candidates?.[0]?.content?.parts) {
          let imageGenerated = false;

          // Look through all parts for image data
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              console.log(
                `Found image data for prompt ${i + 1}, mime type: ${part.inlineData.mimeType}`,
              );

              generatedImages.push({
                id: `img_${Date.now()}_${i}`,
                prompt: prompt,
                position: i,
                base64Data: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
                mimeType: part.inlineData.mimeType || "image/png",
              });
              imageGenerated = true;
              break;
            }
          }

          if (!imageGenerated) {
            console.log(
              `No image data found in response for prompt: ${prompt}`,
            );
            // Skip this image instead of adding placeholder
            console.log(`Skipping image generation for: ${prompt}`);
          }
        } else {
          console.log(`Invalid response structure for prompt: ${prompt}`);
          // Skip this image instead of adding placeholder
        }
      } catch (imageError: any) {
        console.error(
          `Failed to generate image for prompt: ${prompt}`,
          imageError,
        );

        // Check for quota exhausted error (only if quota protection is enabled)
        if (
          IMAGE_GENERATION_CONFIG.ENABLE_QUOTA_PROTECTION &&
          (imageError.message?.includes("QUOTA_EXCEEDED") ||
            imageError.message?.includes("exceeded your current quota") ||
            imageError.message?.includes("RESOURCE_EXHAUSTED") ||
            imageError.message?.includes("429"))
        ) {
          console.log(
            `Quota exhausted - skipping all remaining image generation`,
          );
          quotaExhausted = true;
          break; // Stop generating more images
        } else if (
          imageError.message?.includes("PERMISSION_DENIED") ||
          imageError.message?.includes("API_KEY_INVALID")
        ) {
          console.log(`Skipping image due to API error: ${imageError.message}`);
        } else {
          console.log(
            `Skipping image due to generation error: ${imageError.message}`,
          );
        }
      }

      // Add delay between requests to avoid rate limiting (only if not quota exhausted)
      if (i < limitedPrompts.length - 1 && !quotaExhausted) {
        await new Promise((resolve) =>
          setTimeout(resolve, IMAGE_GENERATION_CONFIG.DELAY_BETWEEN_IMAGES_MS),
        );
      }
    }

    const validImages = generatedImages.filter(
      (img) =>
        img.mimeType !== "image/placeholder" &&
        !img.base64Data.startsWith("placeholder_"),
    );

    console.log(
      `Image generation complete: ${validImages.length}/${limitedPrompts.length} images successfully generated`,
    );

    if (validImages.length < limitedPrompts.length) {
      const reason = quotaExhausted
        ? " due to quota limits"
        : " and will be skipped";
      console.log(
        `Note: ${limitedPrompts.length - validImages.length} images could not be generated${reason}`,
      );
    }

    return generatedImages;
  } catch (error) {
    console.error("Error in image generation:", error);
    return handleApiError(error);
  }
};

// 3. Content Generation
const generateContent = async (
  structure: NotesStructure,
  generatedImages: GeneratedImage[],
  isFallbackStructure: boolean = false,
): Promise<string> => {
  try {
    const apiKeyValue = await getApiKey();
    const genAI = new GoogleGenAI({ apiKey: apiKeyValue });

    const imageReferences =
      generatedImages.length > 0
        ? `\n\nAvailable images to reference:
${generatedImages.map((img, idx) => `Image ${idx + 1}: ${img.prompt}`).join("\n")}`
        : "";

    let contentPrompt: string;

    if (isFallbackStructure) {
      // Special handling for fallback structure - focus on the original prompt
      const originalTopic = structure.contentPrompt
        .replace("Create comprehensive educational notes about: ", "")
        .replace(
          ". Focus on clear explanations, practical examples, and structured learning content.",
          "",
        );

      contentPrompt = `You are an expert educational content creator. Create comprehensive, well-structured notes about: ${originalTopic}

Please organize your response to cover:
1. ${structure.sections[0]?.heading || "Introduction"} - Provide background and overview
2. ${structure.sections[1]?.heading || "Main Content"} - Detailed explanations and key points
3. ${structure.sections[2]?.heading || "Examples"} - Practical examples and applications
4. ${structure.sections[3]?.heading || "Summary"} - Key takeaways and conclusion

Content Guidelines:
- Create comprehensive, unlimited content (NO WORD LIMITS)
- Use PLAIN TEXT formatting with special markers for our custom renderer
- For explanatory content: Write in flowing paragraphs (plain text)
- For bullet points: Use format BULLET_POINT: First point
- For code examples: Use format CODE_BLOCK_START:language then code then CODE_BLOCK_END
- For numbered lists: Use format NUMBERED_POINT: 1. First step
- DO NOT use markdown symbols - use our custom markers instead
- Include specific, practical examples and real-world applications
- Use clear, professional language appropriate for educational content
- Focus on providing maximum educational value and complete understanding
- Include as much detail as needed - there are NO content length restrictions
- For technical topics, use CODE_BLOCK_START/END markers with language specification
- For step-by-step content, use BULLET_POINT markers for clear organization

IMPORTANT: Use ONLY plain text with our custom markers - NO MARKDOWN formatting

Generate the comprehensive educational content now:`;
    } else {
      // Create a natural description of the structure instead of raw JSON
      const structureDescription = `
Title: ${structure.title}

Sections to cover:
${structure.sections
  .map(
    (section, idx) =>
      `${idx + 1}. ${section.heading}${
        section.subsections.length > 0
          ? `
   - ${section.subsections.join("\n   - ")}`
          : ""
      }`,
  )
  .join("\n\n")}`;

      contentPrompt = `You are an expert educational content creator. Generate comprehensive, well-structured notes based on the following outline.

${structureDescription}${imageReferences}

Content Generation Guidelines:
- Create detailed, informative content for each section and subsection listed above
- Use PLAIN TEXT with special markers for our custom renderer
- For explanatory content: Write in plain text paragraphs
- For bullet points: Use BULLET_POINT: Content here format
- For numbered steps: Use NUMBERED_POINT: 1. Step description format
- For code examples: Use CODE_BLOCK_START:language then code then CODE_BLOCK_END format
- DO NOT use markdown formatting
- Include practical examples, key points, and comprehensive explanations
- Reference images naturally when appropriate
- NO CONTENT LENGTH LIMITS - provide complete, thorough coverage
- Focus on maximum educational value and practical applicability
- Include real-world examples, use cases, and detailed explanations
- For technical topics, use CODE_BLOCK markers with proper language specification
- For procedural content, use BULLET_POINT or NUMBERED_POINT markers
- For conceptual topics, use detailed paragraphs with supporting points using markers

Generate comprehensive content using ONLY plain text with our custom markers:`;
    }

    const response = await retryWithBackoff(() =>
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contentPrompt,
        config: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 8192,
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

    // Clean the response to remove JSON artifacts but preserve our custom markers
    let cleanedContent = response.text.trim();

    // Remove common JSON artifacts that might appear in fallback responses
    cleanedContent = cleanedContent.replace(/^\{[\s\S]*?\}$/, ""); // Remove if entire response is JSON
    cleanedContent = cleanedContent.replace(/^```json[\s\S]*?```/gm, ""); // Remove JSON code blocks
    cleanedContent = cleanedContent.replace(/^[\{\[][\s\S]*?[\}\]]$/gm, ""); // Remove standalone JSON objects/arrays
    cleanedContent = cleanedContent.replace(/^\s*"[^"]*":\s*/gm, ""); // Remove JSON key patterns

    // Convert any remaining markdown to our custom format
    cleanedContent = cleanedContent.replace(/^#{1,6}\s+(.+)$/gm, "$1"); // Remove markdown headers
    cleanedContent = cleanedContent.replace(
      /^\*\s+(.+)$/gm,
      "BULLET_POINT: $1",
    ); // Convert * bullets
    cleanedContent = cleanedContent.replace(/^-\s+(.+)$/gm, "BULLET_POINT: $1"); // Convert - bullets
    cleanedContent = cleanedContent.replace(/^•\s+(.+)$/gm, "BULLET_POINT: $1"); // Convert • bullets
    cleanedContent = cleanedContent.replace(
      /^(\d+)\.\s+(.+)$/gm,
      "NUMBERED_POINT: $1. $2",
    ); // Convert numbered lists
    cleanedContent = cleanedContent.replace(
      /```(\w+)?\n([\s\S]*?)\n```/gm,
      (match, lang, code) => {
        return `CODE_BLOCK_START:${lang || "text"}\n${code}\nCODE_BLOCK_END`;
      },
    ); // Convert markdown code blocks

    cleanedContent = cleanedContent.trim();

    // If content is still too short after cleaning, throw error
    if (cleanedContent.length < 50) {
      throw new Error(
        "Received incomplete content from Gemini. Please try again.",
      );
    }

    return cleanedContent;
  } catch (error) {
    return handleApiError(error);
  }
};

// Parse content into structured format with support for points and code blocks
const parseContentToStructure = (
  content: string,
  images: GeneratedImage[],
  structure: NotesStructure,
): NotebookContent[] => {
  const lines = content.split("\n");
  const structuredContent: NotebookContent[] = [];
  let order = 0;
  let imageIndex = 0;

  // Filter out placeholder images (images that failed to generate)
  const validImages = images.filter(
    (img) =>
      img.mimeType !== "image/placeholder" &&
      !img.base64Data.startsWith("placeholder_"),
  );

  let i = 0;
  while (i < lines.length) {
    const trimmedLine = lines[i].trim();

    if (!trimmedLine) {
      i++;
      continue;
    }

    // Check for code blocks with custom markers or traditional markdown
    const isCustomCodeBlock = trimmedLine.startsWith("CODE_BLOCK_START:");
    const isMarkdownCodeBlock = trimmedLine.startsWith("```");

    if (isCustomCodeBlock || isMarkdownCodeBlock) {
      let language: string;

      if (isCustomCodeBlock) {
        language =
          trimmedLine.replace("CODE_BLOCK_START:", "").trim() || "text";
      } else {
        language = trimmedLine.slice(3).trim() || "text";
      }

      const codeLines: string[] = [];
      i++; // Move past opening marker

      const endMarker = isCustomCodeBlock ? "CODE_BLOCK_END" : "```";

      while (i < lines.length && !lines[i].trim().startsWith(endMarker)) {
        codeLines.push(lines[i]);
        i++;
      }

      if (codeLines.length > 0) {
        structuredContent.push({
          type: "code",
          content: codeLines.join("\n"),
          order: order++,
          language: language,
        });
      }
      i++; // Move past closing marker
      continue;
    }

    // Check for custom bullet point and numbered list markers, plus fallback for traditional markdown
    const isBulletPoint = trimmedLine.startsWith("BULLET_POINT:");
    const isNumberedPoint = trimmedLine.startsWith("NUMBERED_POINT:");

    // Fallback for traditional markdown that might slip through
    const isTraditionalBullet =
      trimmedLine.startsWith("•") ||
      trimmedLine.startsWith("-") ||
      trimmedLine.startsWith("*");
    const isTraditionalNumbered = /^\d+\.\s/.test(trimmedLine);

    if (
      isBulletPoint ||
      isNumberedPoint ||
      isTraditionalBullet ||
      isTraditionalNumbered
    ) {
      const points: string[] = [];

      while (i < lines.length) {
        const currentLine = lines[i].trim();
        if (!currentLine) {
          i++;
          continue;
        }

        const isCurrentBullet = currentLine.startsWith("BULLET_POINT:");
        const isCurrentNumbered = currentLine.startsWith("NUMBERED_POINT:");

        // Fallback for traditional markdown
        const isCurrentTraditionalBullet =
          currentLine.startsWith("•") ||
          currentLine.startsWith("-") ||
          currentLine.startsWith("*");
        const isCurrentTraditionalNumbered = /^\d+\.\s/.test(currentLine);

        if (
          isCurrentBullet ||
          isCurrentNumbered ||
          isCurrentTraditionalBullet ||
          isCurrentTraditionalNumbered
        ) {
          // Extract content after the marker (custom or traditional)
          let cleanPoint = currentLine
            .replace(/^BULLET_POINT:\s*/, "")
            .replace(/^NUMBERED_POINT:\s*/, "")
            .replace(/^[•\-*]\s*/, "")
            .replace(/^\d+\.\s*/, "");
          points.push(cleanPoint);
          i++;
        } else {
          break;
        }
      }

      if (points.length > 0) {
        structuredContent.push({
          type: "points",
          content: "Points",
          order: order++,
          points: points,
        });
      }
      continue;
    }

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

      // Insert image after certain content blocks (only if we have valid images)
      if (
        validImages.length > 0 &&
        imageIndex < validImages.length &&
        Math.random() > 0.7
      ) {
        const image = validImages[imageIndex];
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

    i++;
  }

  // Add remaining valid images at the end
  while (imageIndex < validImages.length) {
    const image = validImages[imageIndex];
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
      // Limit to max configured images
      const limitedPrompts = allImagePrompts.slice(
        0,
        IMAGE_GENERATION_CONFIG.MAX_IMAGES_PER_NOTEBOOK,
      );
      const step2 = `Generating ${limitedPrompts.length} images...`;
      console.log("Step 2:", step2);
      onProgress?.(step2);

      try {
        images = await generateImages(limitedPrompts);

        const successfulImages = images.filter(
          (img) =>
            img.mimeType !== "image/placeholder" &&
            !img.base64Data.startsWith("placeholder_"),
        ).length;

        if (successfulImages > 0) {
          onProgress?.(
            `Successfully generated ${successfulImages}/${limitedPrompts.length} images`,
          );
        } else {
          onProgress?.(
            "Image generation completed (proceeding without images)",
          );
        }
      } catch (imageError: any) {
        // Handle quota exhausted errors gracefully
        if (
          imageError.message?.includes("QUOTA_EXCEEDED") ||
          imageError.message?.includes("exceeded your current quota") ||
          imageError.message?.includes("RESOURCE_EXHAUSTED") ||
          imageError.message?.includes("429")
        ) {
          onProgress?.(
            "Image quota exceeded - continuing with text content only...",
          );
          images = []; // Continue without images
        } else {
          // Re-throw other errors
          throw imageError;
        }
      }
    } else {
      onProgress?.("No images needed for this content...");
    }

    // Step 3: Generate content based on structure
    const step3 = "Generating comprehensive content...";
    console.log("Step 3:", step3);
    onProgress?.(step3);

    // Check if we're using fallback structure (indicated by simple title pattern)
    const isFallbackStructure =
      structure.title.startsWith("Notes: ") &&
      structure.sections.length <= 4 &&
      structure.totalImages === 0;

    const rawContent = await generateContent(
      structure,
      images,
      isFallbackStructure,
    );

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
    // Create final notebook object
    onProgress?.("Finalizing notebook...");

    // Count only valid images (exclude placeholders)
    const validImageCount = images.filter(
      (img) =>
        img.mimeType !== "image/placeholder" &&
        !img.base64Data.startsWith("placeholder_"),
    ).length;

    const notebook: GeneratedNotebook = {
      id: `notebook_${Date.now()}`,
      title: structure.title,
      structure,
      content: structuredContent,
      createdAt: new Date().toISOString(),
      totalImages: validImageCount,
      wordCount: rawContent.split(/\s+/).filter((word) => word.length > 0)
        .length,
    };

    console.log("Notebook generation completed successfully!");
    onProgress?.("Generation completed!");
    return notebook;
  } catch (error) {
    console.error("Error in notebook generation:", error);

    // Special handling for quota exhausted errors
    if (
      error instanceof Error &&
      (error.message?.includes("QUOTA_EXCEEDED") ||
        error.message?.includes("exceeded your current quota") ||
        error.message?.includes("RESOURCE_EXHAUSTED") ||
        error.message?.includes("429"))
    ) {
      throw new Error(
        "API quota exceeded. Please try again later or upgrade your Gemini API plan for more quota.",
      );
    }

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
6. Use PLAIN TEXT with custom markers - NO markdown formatting
7. For bullet points use "BULLET_POINT: content" format
8. For code use "CODE_BLOCK_START:language\ncode\nCODE_BLOCK_END" format
9. ${refinementRequest ? "Ensure new content is accurate, relevant, and well-explained" : "Focus on enhancing understanding and retention"}
10. ${refinementRequest ? "If examples are requested, provide practical, real-world examples" : "Add practical examples and applications where appropriate"}
11. ${refinementRequest ? "If clarification is requested, break down complex concepts step-by-step" : "Ensure content is accurate and well-explained"}

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
          maxOutputTokens: 8192,
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

    // Parse the refined content while preserving existing valid images
    const existingImages = notebook.content
      .filter(
        (item) =>
          item.type === "image" &&
          item.imageData &&
          !item.imageData.startsWith("placeholder_"),
      )
      .map((item, index) => ({
        id: `img_refined_${Date.now()}_${index}`,
        prompt: item.content,
        position: index,
        base64Data: item.imageData || "",
        mimeType: item.mimeType || "image/png",
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
      totalImages: existingImages.filter(
        (img) => !img.base64Data.startsWith("placeholder_"),
      ).length,
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
