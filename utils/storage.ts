import { GeneratedNotebook } from "./gemini";
import { getDatabase } from "./database";

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

    // Conservative storage limits
    if (sizeInMB > 50) {
      return {
        hasSpace: false,
        message: `Current storage: ${stats.totalSize}. Please delete some notes to free up space.`,
      };
    }

    // Conservative notebook count
    if (stats.totalNotebooks > 50) {
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
    const database = await getDatabase();
    const result = await database.getAllAsync(
      "SELECT * FROM notebooks ORDER BY savedAt DESC",
    );

    return result.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: JSON.parse(row.content),
      structure: JSON.parse(row.structure),
      wordCount: row.wordCount,
      totalImages: row.totalImages,
      createdAt: row.createdAt,
      savedAt: row.savedAt,
      isSaved: Boolean(row.isSaved),
    }));
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
    const database = await getDatabase();

    // PROACTIVE STORAGE CHECK - Check before attempting to save
    const storageCheck = await checkStorageSpace();

    // If storage space is an issue, try cleanup first
    if (!storageCheck.hasSpace) {
      console.log(
        "Storage check failed, attempting cleanup:",
        storageCheck.message,
      );

      // Perform cleanup before saving
      await cleanupStorage();

      // Check again after cleanup
      const postCleanupCheck = await checkStorageSpace();
      if (!postCleanupCheck.hasSpace) {
        throw new Error(
          `Storage full after cleanup: ${postCleanupCheck.message}`,
        );
      }
    }

    // Optimize notebook data before saving
    const optimizedNotebook = optimizeNotebookForStorage(notebook);

    const savedNotebook: SavedNotebook = {
      ...optimizedNotebook,
      savedAt: new Date().toISOString(),
      isSaved: true,
    };

    // Check if notebook already exists
    const existingNotebook = await database.getFirstAsync(
      "SELECT id FROM notebooks WHERE id = ?",
      [notebook.id],
    );

    if (existingNotebook) {
      // Update existing notebook
      await database.runAsync(
        `UPDATE notebooks SET
         title = ?, content = ?, structure = ?, wordCount = ?,
         totalImages = ?, savedAt = ?, isSaved = ?
         WHERE id = ?`,
        [
          savedNotebook.title,
          JSON.stringify(savedNotebook.content),
          JSON.stringify(savedNotebook.structure),
          savedNotebook.wordCount || 0,
          savedNotebook.totalImages || 0,
          savedNotebook.savedAt,
          1,
          savedNotebook.id,
        ],
      );
    } else {
      // Auto-cleanup if we have too many notebooks
      const countResult = await database.getFirstAsync(
        "SELECT COUNT(*) as count FROM notebooks",
      );
      const notebookCount = (countResult as any)?.count || 0;

      if (notebookCount >= 30) {
        // Keep only the 25 most recent notebooks
        await database.runAsync(`
          DELETE FROM notebooks
          WHERE id NOT IN (
            SELECT id FROM notebooks
            ORDER BY savedAt DESC
            LIMIT 25
          )
        `);
      }

      // Insert new notebook
      await database.runAsync(
        `INSERT INTO notebooks
         (id, title, content, structure, wordCount, totalImages, createdAt, savedAt, isSaved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          savedNotebook.id,
          savedNotebook.title,
          JSON.stringify(savedNotebook.content),
          JSON.stringify(savedNotebook.structure),
          savedNotebook.wordCount || 0,
          savedNotebook.totalImages || 0,
          savedNotebook.createdAt,
          savedNotebook.savedAt,
          1,
        ],
      );
    }

    return true;
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
    const database = await getDatabase();
    const result = await database.runAsync(
      "DELETE FROM notebooks WHERE id = ?",
      [notebookId],
    );
    return result.changes > 0;
  } catch (error) {
    console.error("Error deleting notebook:", error);
    return false;
  }
};

// Check if a notebook is saved
export const isNotebookSaved = async (notebookId: string): Promise<boolean> => {
  try {
    const database = await getDatabase();
    const result = await database.getFirstAsync(
      "SELECT id FROM notebooks WHERE id = ?",
      [notebookId],
    );
    return !!result;
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
    const database = await getDatabase();
    const result = await database.getFirstAsync(
      "SELECT * FROM notebooks WHERE id = ?",
      [notebookId],
    );

    if (!result) return null;

    const row = result as any;
    return {
      id: row.id,
      title: row.title,
      content: JSON.parse(row.content),
      structure: JSON.parse(row.structure),
      wordCount: row.wordCount,
      totalImages: row.totalImages,
      createdAt: row.createdAt,
      savedAt: row.savedAt,
      isSaved: Boolean(row.isSaved),
    };
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
    const database = await getDatabase();
    const result = await database.runAsync(
      "UPDATE notebooks SET title = ?, savedAt = ? WHERE id = ?",
      [newTitle, new Date().toISOString(), notebookId],
    );
    return result.changes > 0;
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
    const database = await getDatabase();

    // Get notebook count
    const countResult = await database.getFirstAsync(
      "SELECT COUNT(*) as count FROM notebooks",
    );
    const totalNotebooks = (countResult as any)?.count || 0;

    // Get total size by querying all content and calculating size
    const notebooks = await database.getAllAsync(
      "SELECT content FROM notebooks",
    );
    let totalSizeBytes = 0;

    for (const notebook of notebooks) {
      const contentString = (notebook as any).content;
      totalSizeBytes += new TextEncoder().encode(contentString).length;
    }

    const sizeInMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    return {
      totalNotebooks,
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
    const database = await getDatabase();

    // Remove notebooks older than 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    await database.runAsync("DELETE FROM notebooks WHERE savedAt < ?", [
      sixMonthsAgo.toISOString(),
    ]);

    // Keep only 40 most recent notebooks
    await database.runAsync(`
      DELETE FROM notebooks
      WHERE id NOT IN (
        SELECT id FROM notebooks
        ORDER BY savedAt DESC
        LIMIT 40
      )
    `);

    return true;
  } catch (error) {
    console.error("Error cleaning up storage:", error);
    return false;
  }
};

// Emergency cleanup function
const emergencyCleanup = async (): Promise<void> => {
  try {
    const database = await getDatabase();

    // Keep only 10 most recent notebooks
    await database.runAsync(`
      DELETE FROM notebooks
      WHERE id NOT IN (
        SELECT id FROM notebooks
        ORDER BY savedAt DESC
        LIMIT 10
      )
    `);
  } catch {
    try {
      // If still failing, keep only 5 most recent
      const database = await getDatabase();
      await database.runAsync(`
        DELETE FROM notebooks
        WHERE id NOT IN (
          SELECT id FROM notebooks
          ORDER BY savedAt DESC
          LIMIT 5
        )
      `);
    } catch {
      // If all else fails, clear everything
      const database = await getDatabase();
      await database.runAsync("DELETE FROM notebooks");
    }
  }
};

// Clear all saved notebooks
export const clearAllNotebooks = async (): Promise<boolean> => {
  try {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM notebooks");
    return true;
  } catch (error) {
    console.error("Error clearing all notebooks:", error);
    return false;
  }
};
