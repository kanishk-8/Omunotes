import * as Print from "expo-print";
import { shareAsync } from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { GeneratedNotebook } from "@/utils/gemini";
import { SavedNotebook } from "@/utils/storage";

interface ExportOptions {
  includeImages?: boolean;
  includeMetadata?: boolean;
}

const defaultOptions: ExportOptions = {
  includeImages: true,
  includeMetadata: true,
};

// Convert notebook content to HTML that matches the app's styling exactly
const convertNotebookToHTML = (
  notebook: GeneratedNotebook | SavedNotebook,
  options: ExportOptions,
): string => {
  // Generate metadata section matching the stats container in the app
  const metadataHTML = options.includeMetadata
    ? `
    <div class="stats-container">
      <div class="stat-item">
        <span class="stat-icon">📄</span>
        <span class="stat-text">${notebook.wordCount} words</span>
      </div>
      <div class="stat-item">
        <span class="stat-icon">🖼️</span>
        <span class="stat-text">${notebook.totalImages} images</span>
      </div>
      <div class="stat-item">
        <span class="stat-icon">📅</span>
        <span class="stat-text">${new Date(notebook.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  `
    : "";

  // Filter content (skip first heading if it matches title, same as app)
  const filteredContent = notebook.content.filter(
    (item: any, index: number) => {
      if (
        index === 0 &&
        item.type === "heading" &&
        item.content
          .toLowerCase()
          .includes(notebook.title.toLowerCase().split(":")[0])
      ) {
        return false;
      }
      return true;
    },
  );

  // Generate content HTML matching the app's exact structure
  const contentHTML = filteredContent
    .map((item: any, index: number) => {
      switch (item.type) {
        case "heading":
          return `
            <div class="content-item">
              <h1 class="heading">${escapeHtml(item.content)}</h1>
            </div>
          `;

        case "subheading":
          return `
            <div class="content-item">
              <h2 class="subheading">${escapeHtml(item.content)}</h2>
            </div>
          `;

        case "text":
          return `
            <div class="content-item">
              <p class="content-text">${escapeHtml(item.content)}</p>
            </div>
          `;

        case "image":
          if (!options.includeImages) {
            return `
              <div class="content-item">
                <div class="image-container">
                  <div class="image-placeholder-text">[Image: ${escapeHtml(item.content)}]</div>
                </div>
              </div>
            `;
          }

          const hasValidImage =
            item.imageData &&
            item.mimeType !== "image/placeholder" &&
            item.imageData.startsWith("data:image");

          if (hasValidImage) {
            return `
              <div class="content-item">
                <div class="image-container">
                  <img src="${item.imageData}" class="generated-image" alt="${escapeHtml(item.content)}" />
                  <div class="image-caption">${escapeHtml(item.content)}</div>
                </div>
              </div>
            `;
          } else {
            // Generate colored placeholder matching app's exact colors and structure
            const colors = [
              "#FF6B6B",
              "#4ECDC4",
              "#45B7D1",
              "#96CEB4",
              "#FFEAA7",
              "#DDA0DD",
            ];
            const bgColor = colors[index % 6];

            return `
              <div class="content-item">
                <div class="image-container">
                  <div class="image-placeholder" style="background-color: ${bgColor};">
                    <div class="placeholder-icon">🖼️</div>
                    <div class="image-placeholder-text">Generated Image</div>
                  </div>
                  <div class="image-caption">${escapeHtml(item.content)}</div>
                </div>
              </div>
            `;
          }

        default:
          return "";
      }
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(notebook.title)}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          padding: 20px;
          color: #333;
        }

        /* Header matching resultHeader and resultTitle from app */
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          padding-top: 40px;
        }

        .result-title {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }

        /* Stats container matching app's statsContainer */
        .stats-container {
          display: flex;
          justify-content: space-around;
          padding: 0 20px 16px 20px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stat-icon {
          font-size: 12px;
        }

        .stat-text {
          font-size: 12px;
          color: #666;
        }

        /* Content area matching contentScrollView */
        .content-scroll-view {
          flex: 1;
          padding: 0 20px;
        }

        /* Content items matching contentItem */
        .content-item {
          margin-bottom: 16px;
        }

        /* Headings matching app's heading style exactly */
        .heading {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 12px;
          color: #333;
        }

        /* Subheadings matching app's subheading style exactly */
        .subheading {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }

        /* Text content matching app's contentText style exactly */
        .content-text {
          font-size: 16px;
          line-height: 24px;
          color: #333;
        }

        /* Image container matching app's imageContainer */
        .image-container {
          margin: 12px 0;
        }

        /* Generated images - full size without height restriction */
        .generated-image {
          width: 100%;
          height: auto;
          max-width: 100%;
          border-radius: 12px;
          margin-bottom: 8px;
          object-fit: contain;
        }

        /* Image placeholder - maintain aspect ratio */
        .image-placeholder {
          min-height: 150px;
          height: auto;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          margin-bottom: 8px;
        }

        .placeholder-icon {
          font-size: 32px;
          color: white;
          margin-bottom: 8px;
        }

        /* Image placeholder text matching app's imagePlaceholderText */
        .image-placeholder-text {
          color: white;
          font-size: 14px;
          font-weight: 600;
        }

        /* Image caption matching app's imageCaption style exactly */
        .image-caption {
          font-size: 12px;
          text-align: center;
          margin-top: 8px;
          color: #666;
        }

        /* Footer */
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #666;
        }

        /* Print optimizations */
        @media print {
          body {
            margin: 0;
            padding: 20px;
          }

          .content-item {
            page-break-inside: avoid;
          }

          .heading {
            page-break-after: avoid;
          }

          .image-container {
            page-break-inside: avoid;
          }
        }

        @page {
          margin: 20px;
        }
      </style>
    </head>
    <body>
      <!-- Header matching the app's result header -->
      <div class="result-header">
        <h1 class="result-title">${escapeHtml(notebook.title)}</h1>
      </div>

      <!-- Stats section matching the app's stats container -->
      ${metadataHTML}

      <!-- Content section matching the app's content scroll view -->
      <div class="content-scroll-view">
        ${contentHTML}
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>Generated by Omunotes • ${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;
};

// Utility function to escape HTML
const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Generate safe filename
const generateSafeFilename = (title: string): string => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = title
    .replace(/[^a-z0-9\s]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 50);

  return `${safeName}_${timestamp}.pdf`;
};

// Main export function
export const exportNotebookToPDF = async (
  notebook: GeneratedNotebook | SavedNotebook,
  options: ExportOptions = defaultOptions,
  onProgress?: (step: string) => void,
): Promise<{ success: boolean; message: string; uri?: string }> => {
  try {
    onProgress?.("Preparing content...");

    const exportOptions = { ...defaultOptions, ...options };
    const htmlContent = convertNotebookToHTML(notebook, exportOptions);

    onProgress?.("Generating PDF...");

    // Use simplified printToFileAsync call
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
    });

    onProgress?.("PDF generated successfully");

    // Generate safe filename
    const filename = generateSafeFilename(notebook.title);
    const finalUri = `${FileSystem.documentDirectory}${filename}`;

    // Copy with proper filename
    await FileSystem.copyAsync({
      from: uri,
      to: finalUri,
    });

    onProgress?.("Opening share dialog...");

    // Share the PDF using expo-sharing
    await shareAsync(finalUri, {
      mimeType: "application/pdf",
      dialogTitle: "Export Notebook",
      UTI: "com.adobe.pdf",
    });

    return {
      success: true,
      message: "PDF exported and shared successfully",
      uri: finalUri,
    };
  } catch (error) {
    console.error("PDF export error:", error);

    let errorMessage = "Failed to export PDF. Please try again.";

    if (error instanceof Error) {
      if (error.message.includes("Print")) {
        errorMessage = "PDF generation failed. Please try again.";
      } else if (error.message.includes("FileSystem")) {
        errorMessage = "Unable to save PDF. Please check storage permissions.";
      } else if (error.message.includes("Sharing")) {
        errorMessage = "Unable to share PDF. Please try again.";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
};

// Export with different preset options
export const exportNotebookWithPresets = {
  // Full export with all content and images
  full: (
    notebook: GeneratedNotebook | SavedNotebook,
    onProgress?: (step: string) => void,
  ) =>
    exportNotebookToPDF(
      notebook,
      {
        includeImages: true,
        includeMetadata: true,
      },
      onProgress,
    ),

  // Compact export without images
  compact: (
    notebook: GeneratedNotebook | SavedNotebook,
    onProgress?: (step: string) => void,
  ) =>
    exportNotebookToPDF(
      notebook,
      {
        includeImages: false,
        includeMetadata: true,
      },
      onProgress,
    ),
};

// Test function for debugging HTML generation
export const testHTMLGeneration = (
  notebook: GeneratedNotebook | SavedNotebook,
): string => {
  const htmlContent = convertNotebookToHTML(notebook, defaultOptions);
  console.log("Generated HTML:", htmlContent);
  return htmlContent;
};

// Check if PDF export is supported
export const isPDFExportSupported = (): boolean => {
  return true; // expo-print is always available when installed
};
