import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  getSavedNotebooks,
  deleteNotebook,
  SavedNotebook,
} from "@/utils/storage";
import { useThemedAlert } from "@/hooks/useThemedAlert";
import { exportNotebookToPDF, isPDFExportSupported } from "@/utils/pdfExport";
import LottieView from "lottie-react-native";

const Home = () => {
  const router = useRouter();
  const [savedNotebooks, setSavedNotebooks] = useState<SavedNotebook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportStep, setExportStep] = useState("");

  // Themed alert hook
  const { alert, confirmDestructive, error, AlertComponent } = useThemedAlert();

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const placeholderColor = useThemeColor({}, "icon");

  const loadSavedNotebooks = async () => {
    try {
      const notebooks = await getSavedNotebooks();
      setSavedNotebooks(notebooks);
    } catch (error) {
      console.error("Error loading notebooks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSavedNotebooks();
    setRefreshing(false);
  }, []);

  // Load notebooks when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSavedNotebooks();
    }, []),
  );

  const handleDeleteNotebook = (notebook: SavedNotebook) => {
    confirmDestructive(
      "Delete Note",
      `Are you sure you want to delete "${notebook.title}"?`,
      async () => {
        const success = await deleteNotebook(notebook.id);
        if (success) {
          setSavedNotebooks((prev) => prev.filter((n) => n.id !== notebook.id));
        } else {
          error("Error", "Failed to delete notebook.");
        }
      },
      undefined,
      "Delete",
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewFullNote = (notebook: SavedNotebook) => {
    router.push(`/notebook?id=${notebook.id}`);
  };

  const handleExportPDF = async (notebook: SavedNotebook) => {
    setIsExportingPDF(true);
    setExportStep("Preparing content...");

    try {
      const result = await exportNotebookToPDF(
        notebook,
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

  const renderNotebookItem = ({ item }: { item: SavedNotebook }) => (
    <View style={[styles.notebookCard, { backgroundColor: backgroundColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <ThemedText
            style={[styles.notebookTitle, { color: textColor }]}
            numberOfLines={2}
          >
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.dateText, { color: placeholderColor }]}>
            Saved {formatDate(item.savedAt)}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteNotebook(item)}
        >
          <Ionicons name="trash-outline" size={20} color={placeholderColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="document-text" size={16} color={tintColor} />
          <ThemedText style={[styles.statText, { color: placeholderColor }]}>
            {item.wordCount} words
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="images" size={16} color={tintColor} />
          <ThemedText style={[styles.statText, { color: placeholderColor }]}>
            {item.totalImages} images
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="layers" size={16} color={tintColor} />
          <ThemedText style={[styles.statText, { color: placeholderColor }]}>
            {item.structure.sections.length} sections
          </ThemedText>
        </View>
      </View>

      {/* Preview of first few content items */}
      <View style={styles.previewContainer}>
        {item.content
          .filter((content) => content.type === "text")
          .slice(0, 2)
          .map((content, index) => (
            <ThemedText
              key={index}
              style={[styles.previewText, { color: placeholderColor }]}
              numberOfLines={2}
            >
              {content.content}
            </ThemedText>
          ))}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handleViewFullNote(item)}
        >
          <ThemedText style={[styles.viewButtonText, { color: tintColor }]}>
            View Full Note
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={tintColor} />
        </TouchableOpacity>

        {isPDFExportSupported() && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => handleExportPDF(item)}
            disabled={isExportingPDF}
          >
            <Ionicons
              name="document-outline"
              size={18}
              color={isExportingPDF ? placeholderColor : tintColor}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="document-text-outline"
        size={64}
        color={placeholderColor}
      />
      <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
        No Saved Notes
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: placeholderColor }]}>
        Create your first AI-powered note in the Create tab and save it to see
        it here.
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: textColor }]}>
            Loading your notes...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            My Notes
          </ThemedText>
          <ThemedText
            style={[styles.headerSubtitle, { color: placeholderColor }]}
          >
            {savedNotebooks.length} saved note
            {savedNotebooks.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        <FlatList
          data={savedNotebooks}
          renderItem={renderNotebookItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tintColor}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />

        {/* PDF Export Progress Modal */}
        <Modal visible={isExportingPDF} transparent={true} animationType="fade">
          <View style={styles.exportOverlay}>
            <View
              style={[styles.exportModal, { backgroundColor: backgroundColor }]}
            >
              <LottieView
                source={require("@/assets/animations/Sushi.json")}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
              <ThemedText style={[styles.exportText, { color: textColor }]}>
                {exportStep}
              </ThemedText>
              <ThemedText
                style={[styles.exportSubtext, { color: placeholderColor }]}
              >
                Converting your notes to PDF...
              </ThemedText>
            </View>
          </View>
        </Modal>
      </ThemedView>

      {/* Themed Alert Component - Positioned as overlay */}
      <AlertComponent />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  notebookCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.2)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  notebookTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.8,
  },
  deleteButton: {
    padding: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  statText: {
    fontSize: 12,
  },
  previewContainer: {
    marginBottom: 16,
    gap: 8,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    flex: 1,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  exportButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "500",
  },

  exportOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  exportModal: {
    padding: 30,
    borderRadius: 16,
    alignItems: "center",
    minWidth: 200,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  exportText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  exportSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    opacity: 0.8,
  },
  lottieAnimation: {
    width: 100,
    height: 100,
  },
});

export default Home;
