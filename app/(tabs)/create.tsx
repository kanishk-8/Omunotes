import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";

import { FileUploadComponent } from "@/components/FileUploadComponent";

const Create = () => {
  const [inputText, setInputText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleAdvancedGeneration = () => {
    setIsGenerating(true);
    // Add your generation logic here
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  return (
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
              isGenerating || (!inputText.trim() && uploadedFiles.length === 0)
            }
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={backgroundColor} />
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
              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}{" "}
              attached
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingVertical: 12,
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

  progressContainer: {
    flex: 1,
    justifyContent: "center",
  },
  cancelButton: {
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
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
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  startOverButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  startOverButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
});

export default Create;
