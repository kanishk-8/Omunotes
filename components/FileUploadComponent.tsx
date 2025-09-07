import React, { useCallback } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useThemeColor } from "@/hooks/useThemeColor";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uri: string;
  mimeType?: string;
}

interface FileUploadComponentProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  onMaxFilesWarning?: (message: string) => void;
  currentFileCount?: number;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onFilesChange,
  maxFiles = 5,
  acceptedTypes = ["image/*", "application/pdf", "text/plain"],
  disabled = false,
  onMaxFilesWarning,
  currentFileCount = 0,
}) => {
  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const placeholderColor = useThemeColor({}, "icon");

  const handleDocumentPick = useCallback(async () => {
    if (disabled) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedTypes,
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: UploadedFile[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          name: asset.name,
          size: asset.size || 0,
          type: asset.mimeType || "unknown",
          uri: asset.uri,
          mimeType: asset.mimeType,
        }));

        const availableSlots = maxFiles - currentFileCount;
        const filteredFiles = newFiles.slice(0, availableSlots);

        if (filteredFiles.length > 0) {
          onFilesChange(filteredFiles);

          // Show warning if some files were not added due to limit
          if (newFiles.length > filteredFiles.length && onMaxFilesWarning) {
            onMaxFilesWarning(
              `Only ${filteredFiles.length} of ${newFiles.length} files were added. Maximum ${maxFiles} files allowed.`,
            );
          }
        }
      }
    } catch (err) {
      if (onMaxFilesWarning) {
        onMaxFilesWarning("Failed to pick document. Please try again.");
      }
      console.error("Document picking error:", err);
    }
  }, [
    currentFileCount,
    maxFiles,
    acceptedTypes,
    disabled,
    onFilesChange,
    onMaxFilesWarning,
  ]);

  const handleImagePick = useCallback(async () => {
    if (disabled) return;

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (onMaxFilesWarning) {
          onMaxFilesWarning("Camera roll permission is required!");
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets) {
        const newFiles: UploadedFile[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          size: asset.fileSize || 0,
          type: asset.type || "image",
          uri: asset.uri,
          mimeType: asset.type || "image/jpeg",
        }));

        const availableSlots = maxFiles - currentFileCount;
        const filteredFiles = newFiles.slice(0, availableSlots);

        if (filteredFiles.length > 0) {
          onFilesChange(filteredFiles);

          // Show warning if some files were not added due to limit
          if (newFiles.length > filteredFiles.length && onMaxFilesWarning) {
            onMaxFilesWarning(
              `Only ${filteredFiles.length} of ${newFiles.length} files were added. Maximum ${maxFiles} files allowed.`,
            );
          }
        }
      }
    } catch (err) {
      if (onMaxFilesWarning) {
        onMaxFilesWarning("Failed to pick image. Please try again.");
      }
      console.error("Image picking error:", err);
    }
  }, [currentFileCount, maxFiles, disabled, onFilesChange, onMaxFilesWarning]);

  const handleCameraPick = useCallback(async () => {
    if (disabled) return;

    // Don't allow camera if already at max files
    if (currentFileCount >= maxFiles) {
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        if (onMaxFilesWarning) {
          onMaxFilesWarning("Camera permission is required!");
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const newFile: UploadedFile = {
          id: `${Date.now()}`,
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          type: asset.type || "image",
          uri: asset.uri,
          mimeType: asset.type || "image/jpeg",
        };

        onFilesChange([newFile]);
      }
    } catch (err) {
      if (onMaxFilesWarning) {
        onMaxFilesWarning("Failed to take photo. Please try again.");
      }
      console.error("Camera error:", err);
    }
  }, [currentFileCount, maxFiles, disabled, onFilesChange, onMaxFilesWarning]);

  const isMaxFilesReached = currentFileCount >= maxFiles;

  return (
    <>
      <ThemedView style={styles.container}>
        {/* Upload Options - Always at bottom of container */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: backgroundColor,
                borderColor: placeholderColor,
                opacity: disabled || isMaxFilesReached ? 0.5 : 1,
              },
            ]}
            onPress={handleCameraPick}
            disabled={disabled || isMaxFilesReached}
          >
            <Ionicons name="camera" size={20} color={tintColor} />
            <ThemedText style={[styles.optionTitle, { color: textColor }]}>
              Camera
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: backgroundColor,
                borderColor: placeholderColor,
                opacity: disabled || isMaxFilesReached ? 0.5 : 1,
              },
            ]}
            onPress={handleImagePick}
            disabled={disabled || isMaxFilesReached}
          >
            <Ionicons name="images" size={20} color={tintColor} />
            <ThemedText style={[styles.optionTitle, { color: textColor }]}>
              Photos
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: backgroundColor,
                borderColor: placeholderColor,
                opacity: disabled || isMaxFilesReached ? 0.5 : 1,
              },
            ]}
            onPress={handleDocumentPick}
            disabled={disabled || isMaxFilesReached}
          >
            <Ionicons name="document" size={20} color={tintColor} />
            <ThemedText style={[styles.optionTitle, { color: textColor }]}>
              Files
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    justifyContent: "flex-end",
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  optionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  optionTitle: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default FileUploadComponent;
