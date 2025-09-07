import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import { generateNotebook, GeneratedNotebook } from "@/utils/gemini";
import {
  saveNotebook,
  isNotebookSaved as checkNotebookSaved,
} from "@/utils/storage";
import LottieView from "lottie-react-native";

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

  const toggleUploadOptions = () => {
    setShowUploadOptions(!showUploadOptions);
    uploadOptionsHeight.value = withTiming(showUploadOptions ? 0 : 120);
  };

  const handleFilesChange = (files: any[]) => {
    setUploadedFiles(files);
  };

  const handleAdvancedGeneration = async () => {
    if (!inputText.trim() && uploadedFiles.length === 0) {
      Alert.alert(
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

      Alert.alert(
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

      Alert.alert("Generation Failed", errorMessage, [
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
        Alert.alert(
          "Success!",
          "Notebook saved successfully. You can view it in the Home tab.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert("Error", "Failed to save notebook. Please try again.");
      }
    } catch (error) {
      console.error("Save error:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save notebook. Please try again.";

      if (
        errorMessage.includes("Storage full") ||
        errorMessage.includes("storage is full")
      ) {
        Alert.alert("Storage Optimized", errorMessage, [
          { text: "OK", style: "default" },
          {
            text: "Try Again",
            onPress: () => handleSaveNotebook(),
          },
          {
            text: "View Saved Notes",
            onPress: () => {
              Alert.alert(
                "Manage Storage",
                "Go to Home tab to view and delete old notes to free up more space.",
                [{ text: "OK" }],
              );
            },
          },
        ]);
      } else {
        Alert.alert("Error", errorMessage);
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
          {generatedNotebook.content
            .filter((item, index) => {
              // Skip the first heading if it matches the notebook title
              if (
                index === 0 &&
                item.type === "heading" &&
                item.content
                  .toLowerCase()
                  .includes(generatedNotebook.title.toLowerCase().split(":")[0])
              ) {
                return false;
              }
              return true;
            })
            .map((item, index) => (
              <View key={index} style={styles.contentItem}>
                {item.type === "heading" && (
                  <ThemedText style={[styles.heading, { color: textColor }]}>
                    {item.content}
                  </ThemedText>
                )}
                {item.type === "subheading" && (
                  <ThemedText style={[styles.subheading, { color: textColor }]}>
                    {item.content}
                  </ThemedText>
                )}
                {item.type === "text" && (
                  <ThemedText
                    style={[styles.contentText, { color: textColor }]}
                  >
                    {item.content}
                  </ThemedText>
                )}
                {item.type === "image" && (
                  <View style={styles.imageContainer}>
                    {item.imageData &&
                    item.mimeType !== "image/placeholder" &&
                    item.imageData.startsWith("data:image") ? (
                      <Image
                        source={{ uri: item.imageData }}
                        style={styles.generatedImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.imagePlaceholder,
                          {
                            backgroundColor: [
                              "#FF6B6B",
                              "#4ECDC4",
                              "#45B7D1",
                              "#96CEB4",
                              "#FFEAA7",
                              "#DDA0DD",
                            ][index % 6],
                          },
                        ]}
                      >
                        <Ionicons name="image" size={32} color="white" />
                        <ThemedText style={styles.imagePlaceholderText}>
                          Generated Image
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText
                      style={[styles.imageCaption, { color: placeholderColor }]}
                    >
                      {item.content}
                    </ThemedText>
                  </View>
                )}
              </View>
            ))}
        </ScrollView>

        {/* Floating Action Buttons */}
        <View style={styles.floatingButtonsContainer}>
          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.floatingButton,
              styles.saveButton,
              {
                backgroundColor: isNotebookSaved ? "#4CAF50" : tintColor,
                opacity: isSaving ? 0.7 : 1,
              },
            ]}
            onPress={handleSaveNotebook}
            disabled={isSaving || isNotebookSaved}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={backgroundColor} />
            ) : (
              <Ionicons
                name={isNotebookSaved ? "checkmark" : "bookmark"}
                size={24}
                color={backgroundColor}
              />
            )}
          </TouchableOpacity>

          {/* New Note Button */}
          <TouchableOpacity
            style={[
              styles.floatingButton,
              styles.newNoteButton,
              { backgroundColor: tintColor },
            ]}
            onPress={handleStartOver}
          >
            <Ionicons name="add" size={28} color={backgroundColor} />
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // Show input form
  return (
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
                  backgroundColor: isGenerating ? placeholderColor : tintColor,
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
              <ThemedText style={[styles.fileCountText, { color: tintColor }]}>
                {uploadedFiles.length} file
                {uploadedFiles.length !== 1 ? "s" : ""} attached
              </ThemedText>
            </View>
          )}
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
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
  contentItem: {
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  subheading: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
  },
  imageContainer: {
    marginVertical: 12,
  },
  generatedImage: {
    height: 180,
    width: "100%",
    borderRadius: 12,
    marginBottom: 8,
  },
  imagePlaceholder: {
    height: 180,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  imagePlaceholderText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  imageCaption: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },

  floatingButtonsContainer: {
    position: "absolute",
    bottom: 30,
    right: 20,
    alignItems: "center",
    gap: 16,
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
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  newNoteButton: {
    // Default styling from floatingButton
  },
});

export default Create;
