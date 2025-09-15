import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
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

// Get base64 encoded logo
const getLogoBase64 = async (): Promise<string> => {
  try {
    const asset = Asset.fromModule(require("../assets/images/icon.png"));
    await asset.downloadAsync();
    const file = new File(asset.localUri || asset.uri);
    const base64 = file.base64();
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.log("Could not load logo:", error);
    return "";
  }
};

// Convert notebook content to HTML that matches the app's styling exactly
const convertNotebookToHTML = async (
  notebook: GeneratedNotebook | SavedNotebook,
  options: ExportOptions,
): Promise<string> => {
  // Get logo base64
  const logoBase64 = await getLogoBase64();

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

        case "points":
          if (!item.points || item.points.length === 0) return "";
          const pointsHTML = item.points
            .map(
              (point: string) =>
                `<li class="point-item">${escapeHtml(point)}</li>`,
            )
            .join("");
          return `
            <div class="content-item">
              <ul class="points-container">
                ${pointsHTML}
              </ul>
            </div>
          `;

        case "code":
          return `
            <div class="content-item">
              <div class="code-container">
                <div class="code-header">
                  <span class="code-language">${escapeHtml(item.language || "code")}</span>
                </div>
                <pre class="code-content"><code>${escapeHtml(item.content)}</code></pre>
              </div>
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
          padding: 12px 20px;
          padding-top: 20px;
        }

        .result-title {
          font-size: 22px;
          font-weight: bold;
          color: #333;
          margin: 0;
        }

        /* Stats container matching app's statsContainer */
        .stats-container {
          display: flex;
          justify-content: space-around;
          padding: 0 20px 12px 20px;
          flex-wrap: wrap;
          gap: 8px;
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
          margin-top: 8px;
        }

        /* Content items matching contentItem */
        .content-item {
          margin-bottom: 8px;
        }

        /* First content item - reduce top spacing */
        .content-item:first-child {
          margin-top: 0;
        }

        /* Headings matching app's heading style exactly */
        .heading {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 6px;
          color: #333;
        }

        /* Subheadings matching app's subheading style exactly */
        .subheading {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #333;
        }

        /* Text content matching app's contentText style exactly */
        .content-text {
          font-size: 16px;
          line-height: 22px;
          color: #333;
          margin: 0;
        }

        /* Image container matching app's imageContainer */
        .image-container {
          margin: 6px 0;
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

        /* Points container matching app's pointsContainer */
        .points-container {
          margin: 6px 0;
          padding: 0;
          list-style: none;
        }

        .point-item {
          position: relative;
          padding-left: 20px;
          margin-bottom: 4px;
          font-size: 16px;
          line-height: 20px;
          color: #333;
        }

        .point-item::before {
          content: '•';
          position: absolute;
          left: 0;
          top: 0;
          color: #007AFF;
          font-weight: bold;
        }

        /* Code container matching app's codeContainer */
        .code-container {
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          margin: 6px 0;
          overflow: hidden;
        }

        .code-header {
          background-color: #e9ecef;
          padding: 8px 16px;
          border-bottom: 1px solid #dee2e6;
          font-size: 12px;
          font-weight: 600;
          color: #007AFF;
          text-transform: uppercase;
        }

        .code-content {
          padding: 16px;
          margin: 0;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 14px;
          line-height: 20px;
          color: #333;
          background: transparent;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .code-content code {
          background: transparent;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
          color: inherit;
        }

        /* Footer */
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #666;
        }

        .footer-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .footer-logo {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        /* Print optimizations */
        @media print {
          body {
            margin: 0;
            padding: 15px;
            line-height: 1.4;
          }

          .content-item {
            page-break-inside: avoid;
            margin-bottom: 4px;
          }

          .heading {
            page-break-after: avoid;
            margin-bottom: 4px;
            margin-top: 8px;
          }

          .subheading {
            page-break-after: avoid;
            margin-bottom: 3px;
            margin-top: 6px;
          }

          .content-text {
            margin: 2px 0;
            line-height: 1.3;
          }

          .image-container {
            page-break-inside: avoid;
            margin: 4px 0;
          }

          .code-container {
            page-break-inside: avoid;
            margin: 4px 0;
          }

          .points-container {
            page-break-inside: avoid;
            margin: 3px 0;
          }

          .point-item {
            margin-bottom: 2px;
            line-height: 1.3;
          }

          .result-header {
            padding: 12px 15px;
            padding-top: 20px;
          }

          .stats-container {
            padding: 0 15px 12px 15px;
          }

          .content-scroll-view {
            padding: 0 15px;
            margin-top: 4px;
          }

          .content-item:first-child {
            margin-top: 0;
          }
        }

        @page {
          margin: 15px;
          size: A4;
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
        <div class="footer-content">
          ${logoBase64 ? `<img src="${logoBase64}" class="footer-logo" alt="Omunotes Logo" />` : ""}
          <p>Generated by Omunotes • ${new Date().toLocaleDateString()}</p>
        </div>
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
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const timeStamp = now.toISOString().slice(11, 19).replace(/:/g, "-");
  const safeName = title
    .replace(/[^a-z0-9\s]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);

  return `${safeName}_${dateStamp}_${timeStamp}.pdf`;
};

// Generate unique filename by checking for conflicts
const generateUniqueFilename = (title: string): string => {
  let filename = generateSafeFilename(title);
  let counter = 1;

  // Check if file exists and generate alternative names
  while (new File(Paths.document, filename).exists) {
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = now.toISOString().slice(11, 19).replace(/:/g, "-");
    const safeName = title
      .replace(/[^a-z0-9\s]/gi, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 35); // Shorter to make room for counter

    filename = `${safeName}_${dateStamp}_${timeStamp}_${counter}.pdf`;
    counter++;

    // Prevent infinite loop
    if (counter > 100) {
      filename = `export_${Date.now()}.pdf`;
      break;
    }
  }

  return filename;
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
    const htmlContent = await convertNotebookToHTML(notebook, exportOptions);

    onProgress?.("Generating PDF...");

    // Use simplified printToFileAsync call
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
    });

    onProgress?.("PDF generated successfully");

    // Generate unique filename to avoid conflicts
    const filename = generateUniqueFilename(notebook.title);

    // Create File objects for source and destination
    const sourceFile = new File(uri);
    const finalFile = new File(Paths.document, filename);

    try {
      // Copy with proper filename using new File API
      sourceFile.copy(finalFile);

      // Clean up temporary file
      if (sourceFile.exists) {
        sourceFile.delete();
      }
    } catch (fileError) {
      console.error("File operation error:", fileError);

      // Clean up temporary file even if copy failed
      try {
        if (sourceFile.exists) {
          sourceFile.delete();
        }
      } catch (cleanupError) {
        console.warn("Failed to cleanup temporary file:", cleanupError);
      }

      throw new Error(
        `Failed to save PDF with filename. ${fileError instanceof Error ? fileError.message : "Unknown error"}`,
      );
    }

    onProgress?.("Opening share dialog...");

    // Share the PDF using expo-sharing
    await Sharing.shareAsync(finalFile.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Export Notebook",
      UTI: "com.adobe.pdf",
    });

    return {
      success: true,
      message: "PDF exported and shared successfully",
      uri: finalFile.uri,
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
export const testHTMLGeneration = async (
  notebook: GeneratedNotebook | SavedNotebook,
): Promise<string> => {
  const htmlContent = await convertNotebookToHTML(notebook, defaultOptions);
  console.log("Generated HTML:", htmlContent);
  return htmlContent;
};

// Check if PDF export is supported
export const isPDFExportSupported = (): boolean => {
  return true; // expo-print is always available when installed
};
