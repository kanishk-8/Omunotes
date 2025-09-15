import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";

import { FileUploadComponent } from "@/components/FileUploadComponent";
import {
  generateNotebook,
  GeneratedNotebook,
  refineNotebook,
} from "@/utils/gemini";
import {
  saveNotebook,
  isNotebookSaved as checkNotebookSaved,
} from "@/utils/storage";
import LottieView from "lottie-react-native";
import { useThemedAlert } from "@/hooks/useThemedAlert";
import { exportNotebookToPDF, isPDFExportSupported } from "@/utils/pdfExport";
import { NotebookContent } from "@/components/NotebookContent";

const Create = () => {
  const [inputText, setInputText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedNotebook, setGeneratedNotebook] =
    useState<GeneratedNotebook | null>(null);
  const [generationStep, setGenerationStep] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isNotebookSaved, setIsNotebookSaved] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportStep, setExportStep] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineStep, setRefineStep] = useState("");
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);

  // Themed alert hook
  const { alert, error, AlertComponent } = useThemedAlert();

  // Theme colors using hooks
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const placeholderColor = useThemeColor({}, "icon");

  // Animation
  const uploadOptionsHeight = useSharedValue(0);
  const uploadOptionsAnimatedStyle = useAnimatedStyle(() => ({
    height: uploadOptionsHeight.value,
  }));

  // FAB Menu Animation
  const menuRotation = useSharedValue(0);
  const menuOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0);

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${menuRotation.value}deg` }],
  }));

  const subButtonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
    transform: [{ scale: menuScale.value }],
  }));

  const toggleUploadOptions = () => {
    setShowUploadOptions(!showUploadOptions);
    // Increased height to accommodate file previews and upload buttons
    uploadOptionsHeight.value = withTiming(showUploadOptions ? 0 : 120);
  };

  const toggleMenu = () => {
    const newState = !isMenuExpanded;
    setIsMenuExpanded(newState);

    menuRotation.value = withTiming(newState ? 45 : 0, { duration: 200 });
    menuOpacity.value = withTiming(newState ? 1 : 0, { duration: 200 });
    menuScale.value = withTiming(newState ? 1 : 0, { duration: 200 });
  };

  const handleFilesChange = (newFiles: any[]) => {
    setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const handleAdvancedGeneration = async () => {
    if (!inputText.trim() && uploadedFiles.length === 0) {
      error(
        "Input Required",
        "Please enter a prompt or upload files to generate notes.",
      );
      return;
    }

    setIsGenerating(true);
    setGenerationStep("Initializing...");

    try {
      setGenerationStep("Analyzing prompt and generating structure...");

      const notebook = await generateNotebook(
        inputText.trim(),
        uploadedFiles,
        (step: string) => setGenerationStep(step),
      );

      setGeneratedNotebook(notebook);
      setGenerationStep("");

      // Reset input after successful generation
      setInputText("");
      setUploadedFiles([]);
      setShowUploadOptions(false);

      alert(
        "Success!",
        `Generated "${notebook.title}" with ${notebook.totalImages} images and ${notebook.wordCount} words.`,
      );
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationStep("");

      let errorMessage = "Failed to generate notebook. Please try again.";

      if (error instanceof Error) {
        if (error.message.includes("overloaded")) {
          errorMessage =
            "Gemini servers are busy. Please wait a few minutes and try again.";
        } else if (error.message.includes("API key")) {
          errorMessage = "Please check your API key in Settings.";
        } else if (
          error.message.includes("QUOTA_EXCEEDED") ||
          error.message.includes("exceeded your current quota") ||
          error.message.includes("RESOURCE_EXHAUSTED") ||
          error.message.includes("API quota exceeded")
        ) {
          errorMessage =
            "API quota exceeded. Your notes were generated but some images may be missing. Please try again later or upgrade your Gemini API plan.";
        } else if (error.message.includes("Rate limit")) {
          errorMessage =
            "Too many requests. Please wait a moment and try again.";
        } else if (
          error.message.includes("JSON Parse error") ||
          error.message.includes("malformed response") ||
          error.message.includes("incomplete response")
        ) {
          errorMessage =
            "Received incomplete response from server. Please try again.";
        } else if (error.message.includes("Invalid response format")) {
          errorMessage =
            "Server returned invalid data format. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }

      alert("Generation Failed", errorMessage, [
        { text: "OK", style: "default" },
        {
          text: "Retry",
          onPress: () => handleAdvancedGeneration(),
          style: "default",
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    setGeneratedNotebook(null);
    setInputText("");
    setUploadedFiles([]);
    setShowUploadOptions(false);
    setIsNotebookSaved(false);
  };

  const handleSaveNotebook = async () => {
    if (!generatedNotebook) return;

    setIsSaving(true);
    try {
      const success = await saveNotebook(generatedNotebook);
      if (success) {
        setIsNotebookSaved(true);
        alert(
          "Success!",
          "Notebook saved successfully. You can view it in the Home tab.",
          [{ text: "OK" }],
        );
      } else {
        error("Error", "Failed to save notebook. Please try again.");
      }
    } catch (err) {
      console.error("Save error:", err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to save notebook. Please try again.";

      if (
        errorMessage.includes("Storage full") ||
        errorMessage.includes("storage is full")
      ) {
        alert("Storage Optimized", errorMessage, [
          { text: "OK", style: "default" },
          {
            text: "Try Again",
            onPress: () => handleSaveNotebook(),
          },
          {
            text: "View Saved Notes",
            onPress: () => {
              alert(
                "Manage Storage",
                "Go to Home tab to view and delete old notes to free up more space.",
                [{ text: "OK" }],
              );
            },
          },
        ]);
      } else {
        error("Error", errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current notebook is already saved
  React.useEffect(() => {
    const checkSavedStatus = async () => {
      if (generatedNotebook) {
        const saved = await checkNotebookSaved(generatedNotebook.id);
        setIsNotebookSaved(saved);
      }
    };
    checkSavedStatus();
  }, [generatedNotebook]);

  const handleExportPDF = async () => {
    if (!generatedNotebook) return;

    setIsExportingPDF(true);
    setExportStep("Preparing content...");

    try {
      const result = await exportNotebookToPDF(
        generatedNotebook,
        {
          includeImages: true,
          includeMetadata: true,
        },
        (step: string) => setExportStep(step),
      );

      if (result.success) {
        alert(
          "Export Successful!",
          "Your notebook has been exported as PDF and is ready to share.",
        );
      } else {
        error("Export Failed", result.message);
      }
    } catch (err) {
      console.error("PDF export error:", err);
      error(
        "Export Failed",
        "An unexpected error occurred while exporting to PDF. Please try again.",
      );
    } finally {
      setIsExportingPDF(false);
      setExportStep("");
    }
  };

  const handleRefineNotes = async (customPrompt?: string) => {
    if (!generatedNotebook) return;

    setIsRefining(true);
    setRefineStep("Analyzing current notes...");
    setShowRefineInput(false);

    try {
      const refinedNotebook = await refineNotebook(
        generatedNotebook,
        customPrompt || undefined,
        (step: string) => setRefineStep(step),
      );

      setGeneratedNotebook(refinedNotebook);
      setIsNotebookSaved(false); // Mark as unsaved since it's been modified
      setRefinePrompt(""); // Clear the prompt

      alert(
        "Refinement Complete!",
        `Your notes have been improved and refined. Word count: ${refinedNotebook.wordCount} words.`,
      );
    } catch (err) {
      console.error("Refinement error:", err);
      error(
        "Refinement Failed",
        "An unexpected error occurred while refining your notes. Please try again.",
      );
    } finally {
      setIsRefining(false);
      setRefineStep("");
    }
  };

  const handleShowRefineOptions = () => {
    setShowRefineInput(true);
  };

  const handleCancelRefine = () => {
    setShowRefineInput(false);
    setRefinePrompt("");
  };

  const handleSubmitRefine = () => {
    if (refinePrompt.trim()) {
      handleRefineNotes(refinePrompt.trim());
    } else {
      handleRefineNotes(); // Use default refinement
    }
  };

  // Show generation progress
  if (isGenerating) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.progressContainer}>
          {/*<ActivityIndicator size="large" color={tintColor} />*/}
          <LottieView
            source={require("@/assets/animations/Sushi.json")}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
          <ThemedText style={[styles.progressText, { color: textColor }]}>
            {generationStep}
          </ThemedText>
          <ThemedText
            style={[styles.progressSubtext, { color: placeholderColor }]}
          >
            {generationStep.includes("Retry")
              ? "Servers are busy, retrying automatically..."
              : "This may take a few moments..."}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Show PDF export progress
  if (isExportingPDF) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.progressContainer}>
          <LottieView
            source={require("@/assets/animations/Sushi.json")}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
          <ThemedText style={[styles.progressText, { color: textColor }]}>
            {exportStep}
          </ThemedText>
          <ThemedText
            style={[styles.progressSubtext, { color: placeholderColor }]}
          >
            Converting your notes to PDF...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Show refine progress
  if (isRefining) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.progressContainer}>
          <LottieView
            source={require("@/assets/animations/Sushi.json")}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
          <ThemedText style={[styles.progressText, { color: textColor }]}>
            {refineStep}
          </ThemedText>
          <ThemedText
            style={[styles.progressSubtext, { color: placeholderColor }]}
          >
            Making your notes even better...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Show refine input modal
  if (showRefineInput) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.refineInputContainer}>
          <View style={styles.refineHeader}>
            <ThemedText style={[styles.refineTitle, { color: textColor }]}>
              Refine Your Notes
            </ThemedText>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelRefine}
            >
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <ThemedText
            style={[styles.refineDescription, { color: placeholderColor }]}
          >
            Tell the AI what you&apos;d like to improve or add to your notes:
          </ThemedText>

          <TextInput
            value={refinePrompt}
            onChangeText={setRefinePrompt}
            placeholderTextColor={placeholderColor}
            placeholder="e.g., Add more examples, explain concepts better, include practical applications..."
            multiline
            style={[
              styles.refineTextInput,
              {
                color: textColor,
                backgroundColor: backgroundColor,
                borderColor: placeholderColor,
              },
            ]}
            autoFocus
          />

          <View style={styles.refineButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.refineActionButton,
                styles.defaultRefineButton,
                { backgroundColor: `${tintColor}20`, borderColor: tintColor },
              ]}
              onPress={() => handleRefineNotes()}
            >
              <ThemedText
                style={[styles.refineButtonText, { color: tintColor }]}
              >
                General Improvement
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.refineActionButton,
                styles.customRefineButton,
                {
                  backgroundColor: refinePrompt.trim()
                    ? tintColor
                    : `${placeholderColor}30`,
                  opacity: refinePrompt.trim() ? 1 : 0.5,
                },
              ]}
              onPress={handleSubmitRefine}
              disabled={!refinePrompt.trim()}
            >
              <ThemedText
                style={[styles.refineButtonText, { color: backgroundColor }]}
              >
                Custom Refinement
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    );
  }

  // Show generated notebook
  if (generatedNotebook) {
    return (
      <ThemedView style={styles.container}>
        {/* Top New Note Button */}

        <View style={styles.resultHeader}>
          <ThemedText style={[styles.resultTitle, { color: textColor }]}>
            {generatedNotebook.title}
          </ThemedText>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="document-text" size={16} color={tintColor} />
            <ThemedText style={[styles.statText, { color: placeholderColor }]}>
              {generatedNotebook.wordCount} words
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="images" size={16} color={tintColor} />
            <ThemedText style={[styles.statText, { color: placeholderColor }]}>
              {generatedNotebook.totalImages} images
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color={tintColor} />
            <ThemedText style={[styles.statText, { color: placeholderColor }]}>
              {new Date(generatedNotebook.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>

        <ScrollView
          style={styles.contentScrollView}
          showsVerticalScrollIndicator={false}
        >
          <NotebookContent
            content={generatedNotebook.content}
            notebookTitle={generatedNotebook.title}
          />
        </ScrollView>

        {/* Floating Action Buttons Menu */}
        <View style={styles.floatingButtonsContainer}>
          {/* Sub Buttons (Collapsible) */}
          <Animated.View
            style={[styles.subButtonsContainer, subButtonsAnimatedStyle]}
            pointerEvents={isMenuExpanded ? "auto" : "none"}
          >
            {/* Refine Button */}
            <TouchableOpacity
              style={[
                styles.floatingButton,
                styles.subButton,
                {
                  backgroundColor: tintColor,
                  opacity: isRefining ? 0.7 : 1,
                },
              ]}
              onPress={() => {
                handleShowRefineOptions();
                toggleMenu();
              }}
              disabled={isRefining}
            >
              {isRefining ? (
                <ActivityIndicator size="small" color={backgroundColor} />
              ) : (
                <Ionicons name="pencil" size={18} color={backgroundColor} />
              )}
            </TouchableOpacity>

            {/* Export PDF Button */}
            {isPDFExportSupported() && (
              <TouchableOpacity
                style={[
                  styles.floatingButton,
                  styles.subButton,
                  {
                    backgroundColor: tintColor,
                    opacity: isExportingPDF ? 0.7 : 1,
                  },
                ]}
                onPress={() => {
                  handleExportPDF();
                  toggleMenu();
                }}
                disabled={isExportingPDF}
              >
                {isExportingPDF ? (
                  <ActivityIndicator size="small" color={backgroundColor} />
                ) : (
                  <Ionicons name="document" size={18} color={backgroundColor} />
                )}
              </TouchableOpacity>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.floatingButton,
                styles.subButton,
                {
                  backgroundColor: isNotebookSaved ? "#4CAF50" : tintColor,
                  opacity: isSaving ? 0.7 : 1,
                },
              ]}
              onPress={() => {
                handleSaveNotebook();
                toggleMenu();
              }}
              disabled={isSaving || isNotebookSaved}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={backgroundColor} />
              ) : (
                <Ionicons
                  name={isNotebookSaved ? "checkmark" : "bookmark"}
                  size={18}
                  color={backgroundColor}
                />
              )}
            </TouchableOpacity>

            {/* New Note Button */}
            <TouchableOpacity
              style={[
                styles.floatingButton,
                styles.subButton,
                { backgroundColor: "#FF6B35" },
              ]}
              onPress={() => {
                handleStartOver();
                toggleMenu();
              }}
            >
              <Ionicons name="refresh" size={18} color={backgroundColor} />
            </TouchableOpacity>
          </Animated.View>

          {/* Main FAB Button */}
          <Animated.View style={menuAnimatedStyle}>
            <TouchableOpacity
              style={[
                styles.floatingButton,
                styles.mainFabButton,
                { backgroundColor: tintColor },
              ]}
              onPress={toggleMenu}
            >
              <Ionicons name="add" size={24} color={backgroundColor} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Themed Alert Component */}
        <AlertComponent />
      </ThemedView>
    );
  }

  // Show input form
  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ThemedView style={styles.container}>
          {/* Main Content Area */}
          <View style={styles.contentArea}>
            <ThemedText style={styles.subtitle}>
              Upload files or enter a prompt to generate AI-powered notes with
              images and comprehensive content
            </ThemedText>
          </View>

          {/* File Previews Section - Outside animated container */}
          {uploadedFiles.length > 0 && showUploadOptions && (
            <View style={styles.filePreviewsContainer}>
              <View style={styles.filesHeader}>
                <ThemedText style={[styles.filesTitle, { color: textColor }]}>
                  Uploaded Files ({uploadedFiles.length}/5)
                </ThemedText>
              </View>
              <ScrollView
                style={styles.filesList}
                showsVerticalScrollIndicator={false}
              >
                {uploadedFiles.map((file, index) => (
                  <View
                    key={index}
                    style={[
                      styles.fileItem,
                      {
                        backgroundColor: backgroundColor,
                        borderColor: `${placeholderColor}30`,
                      },
                    ]}
                  >
                    <View style={styles.fileContent}>
                      {file.type?.startsWith("image/") ? (
                        <Image
                          source={{ uri: file.uri }}
                          style={styles.filePreview}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.fileIconContainer,
                            { backgroundColor: `${tintColor}15` },
                          ]}
                        >
                          <Ionicons
                            name="document"
                            size={20}
                            color={tintColor}
                          />
                        </View>
                      )}
                      <View style={styles.fileInfo}>
                        <ThemedText
                          style={[styles.fileName, { color: textColor }]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </ThemedText>
                        <ThemedText
                          style={[styles.fileSize, { color: placeholderColor }]}
                        >
                          {(file.size / 1024).toFixed(1)} KB
                        </ThemedText>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => {
                        const newFiles = uploadedFiles.filter(
                          (_, i) => i !== index,
                        );
                        setUploadedFiles(newFiles);
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={placeholderColor}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              {/* Max Files Warning */}
              {uploadedFiles.length >= 5 && (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning" size={16} color={placeholderColor} />
                  <ThemedText
                    style={[styles.warningText, { color: placeholderColor }]}
                  >
                    Maximum 5 files reached. Remove some to add more.
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* File Upload Section */}
          <Animated.View
            style={[
              styles.uploadOptionsContainer,
              uploadOptionsAnimatedStyle,
              { backgroundColor: backgroundColor },
            ]}
          >
            <FileUploadComponent
              onFilesChange={handleFilesChange}
              maxFiles={5}
              acceptedTypes={["image/*", "application/pdf", "text/plain"]}
              disabled={isGenerating}
              onMaxFilesWarning={(message) => error("File Upload", message)}
              currentFileCount={uploadedFiles.length}
            />
          </Animated.View>

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              {/* File Upload Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.attachButton,
                  {
                    backgroundColor: showUploadOptions
                      ? placeholderColor
                      : tintColor,
                  },
                ]}
                onPress={toggleUploadOptions}
                disabled={isGenerating}
              >
                <Ionicons
                  name={showUploadOptions ? "close" : "attach"}
                  size={24}
                  color={backgroundColor}
                />
              </TouchableOpacity>

              {/* Text Input */}
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholderTextColor={placeholderColor}
                placeholder="Enter your prompt here..."
                multiline
                style={[
                  styles.textInput,
                  {
                    color: textColor,
                    backgroundColor: backgroundColor,
                    borderColor: placeholderColor,
                  },
                ]}
                editable={!isGenerating}
              />

              {/* Generate Button */}
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  {
                    backgroundColor: isGenerating
                      ? placeholderColor
                      : tintColor,
                  },
                ]}
                onPress={handleAdvancedGeneration}
                disabled={
                  isGenerating ||
                  (!inputText.trim() && uploadedFiles.length === 0)
                }
              >
                {isGenerating ? (
                  // <ActivityIndicator size="small" color={backgroundColor} />
                  <LottieView
                    source={require("@/assets/animations/Sushi.json")}
                    autoPlay
                    loop
                    style={styles.lottieAnimation}
                  />
                ) : (
                  <Ionicons name="sparkles" size={20} color={backgroundColor} />
                )}
              </TouchableOpacity>
            </View>

            {/* File Count Indicator */}
            {uploadedFiles.length > 0 && (
              <View style={styles.fileCountContainer}>
                <Ionicons name="attach" size={16} color={tintColor} />
                <ThemedText
                  style={[styles.fileCountText, { color: tintColor }]}
                >
                  {uploadedFiles.length} file
                  {uploadedFiles.length !== 1 ? "s" : ""} attached
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      </KeyboardAvoidingView>

      {/* Themed Alert Component - Positioned as overlay */}
      <AlertComponent />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // paddingTop: 50,
  },
  contentArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.8,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  uploadOptionsContainer: {
    overflow: "hidden",
  },
  filePreviewsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filesHeader: {
    marginBottom: 12,
  },
  filesTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  filesList: {
    maxHeight: 200,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  fileContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  filePreview: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
  },
  removeButton: {
    padding: 4,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    padding: 12,
    gap: 6,
    backgroundColor: "rgba(255, 196, 0, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 196, 0, 0.3)",
  },
  warningText: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  attachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 16,
  },
  generateButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  fileCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingLeft: 56,
  },
  fileCountText: {
    fontSize: 14,
    fontWeight: "500",
  },
  lottieAnimation: {
    width: 140,
    height: 140,
  },
  progressContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  progressText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    textAlign: "center",
  },
  progressSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  resultContainer: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 80,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  contentScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },

  floatingButtonsContainer: {
    position: "absolute",
    bottom: 30,
    right: 20,
    alignItems: "center",
  },
  subButtonsContainer: {
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  subButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  mainFabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  refineInputContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  refineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  refineTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 8,
  },
  refineDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  refineTextInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 120,
    maxHeight: 200,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  refineButtonsContainer: {
    gap: 12,
  },
  refineActionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  defaultRefineButton: {
    // Styles applied inline
  },
  customRefineButton: {
    // Styles applied inline
  },
  refineButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Create;
