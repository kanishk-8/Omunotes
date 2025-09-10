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
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Detailed Explanation",
        subsections: ["Core Principles", "How It Works", "Important Features"],
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
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Core Content",
        subsections: ["Key Points", "Detailed Information", "Analysis"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Practical Aspects",
        subsections: ["Examples", "Applications", "Implementation"],
        imagePrompts: [],
        imagePositions: [],
      },
      {
        heading: "Summary",
        subsections: ["Key Takeaways", "Conclusion", "Next Steps"],
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
          `Generating image ${i + 1}/${imagePrompts.length}: ${prompt}`,
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

        // Only skip if it's an API-related error, don't add placeholder
        if (
          imageError.message?.includes("QUOTA_EXCEEDED") ||
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

      // Add delay between requests to avoid rate limiting
      if (i < imagePrompts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    const validImages = generatedImages.filter(
      (img) =>
        img.mimeType !== "image/placeholder" &&
        !img.base64Data.startsWith("placeholder_"),
    );

    console.log(
      `Image generation complete: ${validImages.length}/${imagePrompts.length} images successfully generated`,
    );

    if (validImages.length < imagePrompts.length) {
      console.log(
        `Note: ${imagePrompts.length - validImages.length} images could not be generated and will be skipped`,
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
- Write ONLY plain text content - NO markdown, NO JSON, NO special formatting
- Create flowing, educational content that reads naturally
- Include specific examples and practical applications
- Use clear, professional language
- Write in complete paragraphs with natural breaks
- Target 1000-1500 words total
- Focus on providing educational value and comprehensive coverage
- DO NOT include any structural markers, headings, or formatting symbols

Generate the educational content now:`;
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
- DO NOT use any markdown symbols (##, ###, *, -, etc.) - formatting is handled separately
- Write plain text content only
- Use clear, educational language that flows naturally
- Include practical examples, key points, and detailed explanations
- Reference images naturally in the content when appropriate (e.g., "The diagram shows...")
- Write in paragraph form with natural breaks between ideas
- Target length: 1000-2000 words total
- Focus on substance and educational value rather than formatting
- DO NOT include any JSON structure or formatting in your response

Generate clean, plain text content covering all the sections and subsections listed above:`;
    }

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

    // Clean the response to remove any JSON artifacts or formatting
    let cleanedContent = response.text.trim();

    // Remove common JSON artifacts that might appear in fallback responses
    cleanedContent = cleanedContent.replace(/^\{[\s\S]*?\}$/, ""); // Remove if entire response is JSON
    cleanedContent = cleanedContent.replace(/^```json[\s\S]*?```/gm, ""); // Remove JSON code blocks
    cleanedContent = cleanedContent.replace(/^```[\s\S]*?```/gm, ""); // Remove any code blocks
    cleanedContent = cleanedContent.replace(/^[\{\[][\s\S]*?[\}\]]$/gm, ""); // Remove standalone JSON objects/arrays
    cleanedContent = cleanedContent.replace(/^\s*"[^"]*":\s*/gm, ""); // Remove JSON key patterns
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

  // Filter out placeholder images (images that failed to generate)
  const validImages = images.filter(
    (img) =>
      img.mimeType !== "image/placeholder" &&
      !img.base64Data.startsWith("placeholder_"),
  );

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
      const step2 = `Generating ${allImagePrompts.length} images...`;
      console.log("Step 2:", step2);
      onProgress?.(step2);
      images = await generateImages(allImagePrompts);

      const successfulImages = images.filter(
        (img) =>
          img.mimeType !== "image/placeholder" &&
          !img.base64Data.startsWith("placeholder_"),
      ).length;

      if (successfulImages > 0) {
        onProgress?.(
          `Successfully generated ${successfulImages}/${allImagePrompts.length} images`,
        );
      } else {
        onProgress?.("Image generation completed (proceeding without images)");
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
