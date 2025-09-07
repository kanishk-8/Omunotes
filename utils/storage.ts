import AsyncStorage from "@react-native-async-storage/async-storage";
import { GeneratedNotebook } from "./gemini";

const STORAGE_KEY = "saved_notebooks";

export interface SavedNotebook extends GeneratedNotebook {
  savedAt: string;
  isSaved: boolean;
}

// Optimize notebook data for storage - only remove actual placeholders
const optimizeNotebookForStorage = (
  notebook: GeneratedNotebook,
): GeneratedNotebook => {
  return {
    ...notebook,
    content: notebook.content.map((item) => {
      // Only remove placeholder images that are not real base64 data
      if (item.type === "image" && item.mimeType === "image/placeholder") {
        return {
          ...item,
          imageData: undefined, // Remove placeholder data only
        };
      }
      // Keep everything else as-is, including real base64 images and all text
      return item;
    }),
  };
};

// Check available storage space
const checkStorageSpace = async (): Promise<{
  hasSpace: boolean;
  message: string;
}> => {
  try {
    const stats = await getStorageStats();
    const sizeInMB = parseFloat(stats.totalSize.replace(" MB", ""));

    // Warn if storage is getting large (>100MB)
    if (sizeInMB > 100) {
      return {
        hasSpace: false,
        message: `Current storage: ${stats.totalSize}. Please delete some notes to free up space.`,
      };
    }

    // Warn if too many notebooks
    if (stats.totalNotebooks > 200) {
      return {
        hasSpace: false,
        message: `You have ${stats.totalNotebooks} notes. Please delete some older notes.`,
      };
    }

    return { hasSpace: true, message: "Storage OK" };
  } catch (error) {
    console.error("Error checking storage space:", error);
    return { hasSpace: true, message: "Could not check storage" };
  }
};

// Get all saved notebooks
export const getSavedNotebooks = async (): Promise<SavedNotebook[]> => {
  try {
    const savedData = await AsyncStorage.getItem(STORAGE_KEY);
    if (savedData) {
      return JSON.parse(savedData);
    }
    return [];
  } catch (error) {
    console.error("Error getting saved notebooks:", error);
    return [];
  }
};

// Save a notebook
export const saveNotebook = async (
  notebook: GeneratedNotebook,
): Promise<boolean> => {
  try {
    let existingNotebooks = await getSavedNotebooks();

    // Check if notebook already exists
    const existingIndex = existingNotebooks.findIndex(
      (saved) => saved.id === notebook.id,
    );

    // Optimize notebook data before saving
    const optimizedNotebook = optimizeNotebookForStorage(notebook);

    const savedNotebook: SavedNotebook = {
      ...optimizedNotebook,
      savedAt: new Date().toISOString(),
      isSaved: true,
    };

    if (existingIndex >= 0) {
      // Update existing notebook
      existingNotebooks[existingIndex] = savedNotebook;
    } else {
      // Auto-cleanup if we have too many notebooks
      if (existingNotebooks.length >= 50) {
        // Keep only the 40 most recent notebooks
        existingNotebooks = existingNotebooks.slice(0, 40);
      }

      // Add new notebook to the beginning of the array
      existingNotebooks.unshift(savedNotebook);
    }

    // Try to save with retry and cleanup
    return await saveWithRetry(existingNotebooks);
  } catch (error) {
    console.error("Error saving notebook:", error);

    // Handle specific storage errors
    if (error instanceof Error) {
      if (
        error.message.includes("SQLITE_FULL") ||
        error.message.includes("Storage full") ||
        error.message.includes("database or disk is full")
      ) {
        // Try emergency cleanup and save again
        await emergencyCleanup();
        throw new Error(
          "Device storage is full. Old notes have been cleaned up. Please try saving again.",
        );
      } else if (error.message.includes("QuotaExceededError")) {
        throw new Error(
          "Storage quota exceeded. Please delete some notes to free up space.",
        );
      }
    }

    throw error;
  }
};

// Delete a notebook
export const deleteNotebook = async (notebookId: string): Promise<boolean> => {
  try {
    const existingNotebooks = await getSavedNotebooks();
    const filteredNotebooks = existingNotebooks.filter(
      (notebook) => notebook.id !== notebookId,
    );

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredNotebooks));
    return true;
  } catch (error) {
    console.error("Error deleting notebook:", error);
    return false;
  }
};

// Check if a notebook is saved
export const isNotebookSaved = async (notebookId: string): Promise<boolean> => {
  try {
    const savedNotebooks = await getSavedNotebooks();
    return savedNotebooks.some((notebook) => notebook.id === notebookId);
  } catch (error) {
    console.error("Error checking if notebook is saved:", error);
    return false;
  }
};

// Get a specific notebook by ID
export const getNotebookById = async (
  notebookId: string,
): Promise<SavedNotebook | null> => {
  try {
    const savedNotebooks = await getSavedNotebooks();
    return (
      savedNotebooks.find((notebook) => notebook.id === notebookId) || null
    );
  } catch (error) {
    console.error("Error getting notebook by ID:", error);
    return null;
  }
};

// Update notebook title
export const updateNotebookTitle = async (
  notebookId: string,
  newTitle: string,
): Promise<boolean> => {
  try {
    const existingNotebooks = await getSavedNotebooks();
    const notebookIndex = existingNotebooks.findIndex(
      (notebook) => notebook.id === notebookId,
    );

    if (notebookIndex >= 0) {
      existingNotebooks[notebookIndex].title = newTitle;
      existingNotebooks[notebookIndex].savedAt = new Date().toISOString();
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(existingNotebooks),
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating notebook title:", error);
    return false;
  }
};

// Get storage stats
export const getStorageStats = async (): Promise<{
  totalNotebooks: number;
  totalSize: string;
}> => {
  try {
    const savedNotebooks = await getSavedNotebooks();
    const dataString = JSON.stringify(savedNotebooks);
    const sizeInBytes = new TextEncoder().encode(dataString).length;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    return {
      totalNotebooks: savedNotebooks.length,
      totalSize: `${sizeInMB} MB`,
    };
  } catch (error) {
    console.error("Error getting storage stats:", error);
    return {
      totalNotebooks: 0,
      totalSize: "0 MB",
    };
  }
};

// Cleanup old or large notebooks
export const cleanupStorage = async (): Promise<boolean> => {
  try {
    const notebooks = await getSavedNotebooks();

    // Remove notebooks older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const filteredNotebooks = notebooks
      .filter((notebook) => new Date(notebook.savedAt) > oneYearAgo)
      .slice(0, 100); // Keep only 100 most recent

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredNotebooks));
    return true;
  } catch (error) {
    console.error("Error cleaning up storage:", error);
    return false;
  }
};

// Save with retry and automatic cleanup
const saveWithRetry = async (notebooks: SavedNotebook[]): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
    return true;
  } catch (error: any) {
    if (
      error.message?.includes("SQLITE_FULL") ||
      error.message?.includes("database or disk is full")
    ) {
      // Emergency cleanup - keep 3/4 of the notebooks
      const reducedNotebooks = notebooks.slice(
        0,
        Math.ceil((notebooks.length * 3) / 4),
      );
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(reducedNotebooks),
        );
        return true;
      } catch (retryError) {
        // If still failing, keep only half with full content including images
        const minimalNotebooks = notebooks.slice(
          0,
          Math.ceil(notebooks.length / 2),
        );
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(minimalNotebooks),
        );
        return true;
      }
    }
    throw error;
  }
};

// Emergency cleanup function
const emergencyCleanup = async (): Promise<void> => {
  try {
    const notebooks = await getSavedNotebooks();
    // Keep only 10 most recent notebooks with full content including images
    const cleanedNotebooks = notebooks.slice(0, 10);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedNotebooks));
  } catch (error) {
    try {
      // If still failing, keep only 5 most recent with full content
      const notebooks = await getSavedNotebooks();
      const minimalNotebooks = notebooks.slice(0, 5);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(minimalNotebooks));
    } catch (finalError) {
      // If all else fails, clear everything
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }
};

// Clear all saved notebooks
export const clearAllNotebooks = async (): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing all notebooks:", error);
    return false;
  }
};
