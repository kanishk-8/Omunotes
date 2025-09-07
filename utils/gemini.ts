import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ApiKey } from "@/types/notes";

export const Gemini = async (prompt: string): Promise<string> => {
  try {
    // Get API key from AsyncStorage
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

    // Initialize the Google Gen AI client
    const genAI = new GoogleGenAI({
      apiKey: apiKey.value,
    });

    // Prepare the enhanced prompt for note-taking
    const enhancedPrompt = `You are a helpful note-taking assistant. Create comprehensive, well-structured notes based on the following prompt. Format the response with clear headings, bullet points, and organize the information logically. Make the notes detailed and useful for studying or reference.

Prompt: ${prompt}`;

    // Generate content using the new SDK
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: enhancedPrompt,
      config: {
        temperature: 0.7,
        topK: 1,
        topP: 1,
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
    });

    // Extract the generated text
    if (response.text) {
      return response.text;
    } else {
      throw new Error("No content generated. Please try a different prompt.");
    }
  } catch (error) {
    console.error("Gemini API Error:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("API_KEY_INVALID")) {
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
      } else {
        throw error;
      }
    } else {
      throw new Error("An unexpected error occurred while generating notes.");
    }
  }
};
