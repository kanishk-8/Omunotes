import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getNotebookById, SavedNotebook } from "@/utils/storage";
import { useThemedAlert } from "@/hooks/useThemedAlert";
import { exportNotebookToPDF, isPDFExportSupported } from "@/utils/pdfExport";
import LottieView from "lottie-react-native";
import { NotebookContent } from "@/components/NotebookContent";

const NotebookPage = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [notebook, setNotebook] = useState<SavedNotebook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportStep, setExportStep] = useState("");

  // Themed alert hook
  const { alert, error, AlertComponent } = useThemedAlert();

  // Theme colors
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const placeholderColor = useThemeColor({}, "icon");

  useEffect(() => {
    const loadNotebook = async () => {
      if (!id) {
        router.back();
        return;
      }

      try {
        setIsLoading(true);
        const savedNotebook = await getNotebookById(id);
        if (savedNotebook) {
          setNotebook(savedNotebook);
        } else {
          error("Error", "Notebook not found.");
          router.back();
        }
      } catch (err) {
        console.error("Error loading notebook:", err);
        error("Error", "Failed to load notebook.");
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadNotebook();
  }, [id, router, error]);

  const handleExportPDF = async () => {
    if (!notebook) return;

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

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: textColor }]}>
            Loading notebook...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!notebook) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={placeholderColor}
          />
          <ThemedText style={[styles.errorTitle, { color: textColor }]}>
            Notebook Not Found
          </ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ThemedText style={[styles.backButtonText, { color: tintColor }]}>
              Go Back
            </ThemedText>
          </TouchableOpacity>
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

  return (
    <>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: `${placeholderColor}30` },
          ]}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={tintColor} />
          </TouchableOpacity>
          <ThemedText
            style={[styles.title, { color: textColor }]}
            numberOfLines={1}
          >
            {notebook.title}
          </ThemedText>
          <View style={styles.headerActions}>
            {isPDFExportSupported() && (
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExportPDF}
                disabled={isExportingPDF}
              >
                {isExportingPDF ? (
                  <ActivityIndicator size="small" color={tintColor} />
                ) : (
                  <Ionicons name="document" size={20} color={tintColor} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="document-text" size={16} color={tintColor} />
            <ThemedText style={[styles.statText, { color: placeholderColor }]}>
              {notebook.wordCount} words
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="images" size={16} color={tintColor} />
            <ThemedText style={[styles.statText, { color: placeholderColor }]}>
              {notebook.totalImages} images
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color={tintColor} />
            <ThemedText style={[styles.statText, { color: placeholderColor }]}>
              {new Date(notebook.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <NotebookContent
            content={notebook.content}
            notebookTitle={notebook.title}
          />
        </ScrollView>
      </ThemedView>

      {/* Themed Alert Component */}
      <AlertComponent />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exportButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 24,
    textAlign: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
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
  lottieAnimation: {
    width: 100,
    height: 100,
  },
});

export default NotebookPage;
