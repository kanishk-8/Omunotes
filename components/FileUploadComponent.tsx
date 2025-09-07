import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
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
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onFilesChange,
  maxFiles = 5,
  acceptedTypes = ["image/*", "application/pdf", "text/plain"],
  disabled = false,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const placeholderColor = useThemeColor({}, "icon");

  const updateFiles = useCallback(
    (newFiles: UploadedFile[]) => {
      setUploadedFiles(newFiles);
      onFilesChange(newFiles);
    },
    [onFilesChange],
  );

  const handleDocumentPick = useCallback(async () => {
    if (disabled || uploadedFiles.length >= maxFiles) return;

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

        const filteredFiles = newFiles.slice(
          0,
          maxFiles - uploadedFiles.length,
        );
        updateFiles([...uploadedFiles, ...filteredFiles]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick document. Please try again.");
    }
  }, [uploadedFiles, maxFiles, acceptedTypes, disabled, updateFiles]);

  const handleImagePick = useCallback(async () => {
    if (disabled || uploadedFiles.length >= maxFiles) return;

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Camera roll permission is required!");
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

        const filteredFiles = newFiles.slice(
          0,
          maxFiles - uploadedFiles.length,
        );
        updateFiles([...uploadedFiles, ...filteredFiles]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  }, [uploadedFiles, maxFiles, disabled, updateFiles]);

  const handleCameraPick = useCallback(async () => {
    if (disabled || uploadedFiles.length >= maxFiles) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Camera permission is required!");
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

        updateFiles([...uploadedFiles, newFile]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }, [uploadedFiles, maxFiles, disabled, updateFiles]);

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      const newFiles = uploadedFiles.filter((file) => file.id !== fileId);
      updateFiles(newFiles);
    },
    [uploadedFiles, updateFiles],
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    if (type.startsWith("image/")) return "image";
    if (type.includes("pdf")) return "document";
    if (type.includes("text")) return "document-text";
    return "document";
  };

  const isMaxFilesReached = uploadedFiles.length >= maxFiles;

  return (
    <ThemedView style={styles.container}>
      {/* Upload Options */}
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

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <>
          <View style={styles.filesHeader}>
            <ThemedText style={[styles.filesTitle, { color: textColor }]}>
              Uploaded Files ({uploadedFiles.length}/{maxFiles})
            </ThemedText>
          </View>

          <ScrollView
            style={styles.filesList}
            showsVerticalScrollIndicator={false}
          >
            {uploadedFiles.map((file) => (
              <View
                key={file.id}
                style={[
                  styles.fileItem,
                  {
                    backgroundColor: backgroundColor,
                    borderColor: `${placeholderColor}30`,
                  },
                ]}
              >
                <View style={styles.fileContent}>
                  {file.type.startsWith("image/") ? (
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
                        name={getFileIcon(file.type)}
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
                      {formatFileSize(file.size)}
                    </ThemedText>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveFile(file.id)}
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
        </>
      )}

      {/* Max Files Warning */}
      {isMaxFilesReached && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={16} color={placeholderColor} />
          <ThemedText style={[styles.warningText, { color: placeholderColor }]}>
            Maximum {maxFiles} files reached. Remove some to add more.
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
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
  filesHeader: {
    marginTop: 20,
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
    marginTop: 16,
    padding: 12,
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    textAlign: "center",
  },
});

export default FileUploadComponent;
