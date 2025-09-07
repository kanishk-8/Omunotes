import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFocusEffect } from "@react-navigation/native";
import {
  getSavedNotebooks,
  deleteNotebook,
  SavedNotebook,
} from "@/utils/storage";
import { useThemedAlert } from "@/hooks/useThemedAlert";

const Home = () => {
  const [savedNotebooks, setSavedNotebooks] = useState<SavedNotebook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotebook, setSelectedNotebook] =
    useState<SavedNotebook | null>(null);
  const [showFullNote, setShowFullNote] = useState(false);

  // Themed alert hook
  const { confirmDestructive, error, AlertComponent } = useThemedAlert();

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
    setSelectedNotebook(notebook);
    setShowFullNote(true);
  };

  const closeFullNote = () => {
    setShowFullNote(false);
    setSelectedNotebook(null);
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

      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => handleViewFullNote(item)}
      >
        <ThemedText style={[styles.viewButtonText, { color: tintColor }]}>
          View Full Note
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={tintColor} />
      </TouchableOpacity>
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

        {/* Full Note Modal */}
        <Modal
          visible={showFullNote}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeFullNote}
        >
          <ThemedView style={styles.modalContainer}>
            {selectedNotebook && (
              <>
                <View
                  style={[
                    styles.modalHeader,
                    { borderBottomColor: `${placeholderColor}30` },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeFullNote}
                  >
                    <Ionicons name="close" size={24} color={tintColor} />
                  </TouchableOpacity>
                  <ThemedText
                    style={[styles.modalTitle, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {selectedNotebook.title}
                  </ThemedText>
                  <View style={styles.placeholder} />
                </View>

                <ScrollView
                  style={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedNotebook.content
                    .filter((item, index) => {
                      // Skip the first heading if it matches the notebook title
                      if (
                        index === 0 &&
                        item.type === "heading" &&
                        item.content
                          .toLowerCase()
                          .includes(
                            selectedNotebook.title.toLowerCase().split(":")[0],
                          )
                      ) {
                        return false;
                      }
                      return true;
                    })
                    .map((item, index) => (
                      <View key={index} style={styles.contentItem}>
                        {item.type === "heading" && (
                          <ThemedText
                            style={[styles.modalHeading, { color: textColor }]}
                          >
                            {item.content}
                          </ThemedText>
                        )}
                        {item.type === "subheading" && (
                          <ThemedText
                            style={[
                              styles.modalSubheading,
                              { color: textColor },
                            ]}
                          >
                            {item.content}
                          </ThemedText>
                        )}
                        {item.type === "text" && (
                          <ThemedText
                            style={[styles.modalText, { color: textColor }]}
                          >
                            {item.content}
                          </ThemedText>
                        )}
                        {item.type === "image" && (
                          <View style={styles.modalImageContainer}>
                            {item.imageData &&
                            item.mimeType !== "image/placeholder" &&
                            item.imageData.startsWith("data:image") ? (
                              <Image
                                source={{ uri: item.imageData }}
                                style={styles.modalImage}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.modalImagePlaceholder,
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
                                <Ionicons
                                  name="image"
                                  size={32}
                                  color="white"
                                />
                                <ThemedText
                                  style={styles.modalImagePlaceholderText}
                                >
                                  Generated Image
                                </ThemedText>
                              </View>
                            )}
                            <ThemedText
                              style={[
                                styles.modalImageCaption,
                                { color: placeholderColor },
                              ]}
                            >
                              {item.content}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    ))}
                </ScrollView>
              </>
            )}
          </ThemedView>
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
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  placeholder: {
    width: 32,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  contentItem: {
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  modalSubheading: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalImageContainer: {
    marginVertical: 12,
  },
  modalImage: {
    height: 200,
    width: "100%",
    borderRadius: 12,
    marginBottom: 8,
  },
  modalImagePlaceholder: {
    height: 200,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modalImagePlaceholderText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  modalImageCaption: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});

export default Home;
