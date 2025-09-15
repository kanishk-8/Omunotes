import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import * as Clipboard from "expo-clipboard";

export interface NotebookContentItem {
  type: "text" | "image" | "heading" | "subheading" | "points" | "code";
  content: string;
  order: number;
  imageData?: string;
  mimeType?: string;
  language?: string;
  points?: string[];
}

interface NotebookContentProps {
  content: NotebookContentItem[];
  notebookTitle: string;
  containerStyle?: any;
}

export const NotebookContent: React.FC<NotebookContentProps> = ({
  content,
  notebookTitle,
  containerStyle,
}) => {
  // State for image viewer
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Theme colors
  const textColor = useThemeColor({}, "text");
  const placeholderColor = useThemeColor({}, "icon");
  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");

  // Filter content (skip first heading if it matches title, same as both pages)
  const filteredContent = content.filter((item, index) => {
    if (
      index === 0 &&
      item.type === "heading" &&
      item.content
        .toLowerCase()
        .includes(notebookTitle.toLowerCase().split(":")[0])
    ) {
      return false;
    }
    return true;
  });

  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setShowImageViewer(true);
  };

  const closeImageViewer = () => {
    setShowImageViewer(false);
    setSelectedImage(null);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  const renderCodeBlock = (item: NotebookContentItem) => {
    const isCopied = copiedCode === item.content;

    return (
      <View
        style={[
          styles.codeContainer,
          { backgroundColor: `${placeholderColor}10` },
        ]}
      >
        <View style={styles.codeHeader}>
          <View style={styles.codeLanguage}>
            <Ionicons name="code" size={16} color={tintColor} />
            <ThemedText style={[styles.codeLanguageText, { color: tintColor }]}>
              {item.language || "code"}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[
              styles.copyButton,
              { backgroundColor: isCopied ? "#4CAF50" : tintColor },
            ]}
            onPress={() => handleCopyCode(item.content)}
          >
            <Ionicons
              name={isCopied ? "checkmark" : "copy"}
              size={16}
              color={backgroundColor}
            />
            <ThemedText
              style={[styles.copyButtonText, { color: backgroundColor }]}
            >
              {isCopied ? "Copied!" : "Copy"}
            </ThemedText>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          style={styles.codeScrollView}
          showsHorizontalScrollIndicator={false}
        >
          <ThemedText style={[styles.codeText, { color: textColor }]}>
            {item.content}
          </ThemedText>
        </ScrollView>
      </View>
    );
  };

  const renderPointsList = (item: NotebookContentItem) => {
    if (!item.points || item.points.length === 0) return null;

    return (
      <View style={styles.pointsContainer}>
        {item.points.map((point, index) => (
          <View key={index} style={styles.pointItem}>
            <View
              style={[styles.pointBullet, { backgroundColor: tintColor }]}
            />
            <ThemedText style={[styles.pointText, { color: textColor }]}>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  };

  const renderContentItem = (item: NotebookContentItem, index: number) => {
    switch (item.type) {
      case "heading":
        return (
          <ThemedText style={[styles.heading, { color: textColor }]}>
            {item.content}
          </ThemedText>
        );

      case "subheading":
        return (
          <ThemedText style={[styles.subheading, { color: textColor }]}>
            {item.content}
          </ThemedText>
        );

      case "text":
        return (
          <ThemedText style={[styles.contentText, { color: textColor }]}>
            {item.content}
          </ThemedText>
        );

      case "points":
        return renderPointsList(item);

      case "code":
        return renderCodeBlock(item);

      case "image":
        const hasValidImage =
          item.imageData &&
          item.mimeType !== "image/placeholder" &&
          item.imageData.startsWith("data:image");

        return (
          <View style={styles.imageContainer}>
            {hasValidImage ? (
              <TouchableOpacity
                onPress={() => handleImagePress(item.imageData!)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: item.imageData }}
                  style={styles.generatedImage}
                  contentFit="contain"
                />
              </TouchableOpacity>
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
        );

      default:
        return null;
    }
  };

  return (
    <>
      <View style={containerStyle}>
        {filteredContent.map((item, index) => (
          <View key={index} style={styles.contentItem}>
            {renderContentItem(item, index)}
          </View>
        ))}
      </View>

      {/* Full Screen Image Viewer Modal */}
      <Modal
        visible={showImageViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <ThemedView style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={closeImageViewer}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          {selectedImage && (
            <TouchableOpacity
              style={styles.imageViewerContent}
              activeOpacity={1}
              onPress={closeImageViewer}
            >
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullScreenImage}
                contentFit="contain"
              />
            </TouchableOpacity>
          )}
        </ThemedView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
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
    width: "100%",
    height: "auto",
    minHeight: 150,
    maxHeight: 400,
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
  pointsContainer: {
    marginVertical: 8,
  },
  pointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingLeft: 4,
  },
  pointBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 12,
    flexShrink: 0,
  },
  pointText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  codeContainer: {
    borderRadius: 12,
    marginVertical: 12,
    overflow: "hidden",
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  codeLanguage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  codeLanguageText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  codeScrollView: {
    maxHeight: 300,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14,
    lineHeight: 20,
    padding: 16,
    paddingTop: 12,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  imageViewerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  fullScreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
