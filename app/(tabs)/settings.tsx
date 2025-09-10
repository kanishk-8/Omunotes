import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemedButton } from "@/components/ThemedButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useRouter } from "expo-router";
import { ThemeToggler } from "@/components/ThemeToggler";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { ApiKey } from "@/types/notes";
import { useThemedAlert } from "@/hooks/useThemedAlert";
import { clearAllNotebooks } from "@/utils/storage";

const Settings = () => {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [newKeyValue, setNewKeyValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const placeholderColor = useThemeColor({}, "icon");
  const tintColor = useThemeColor({}, "tint");
  const cardBackground = useThemeColor({}, "background");

  // Themed alert hook
  const { confirmDestructive, success, error, AlertComponent } =
    useThemedAlert();

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const stored = await AsyncStorage.getItem("apiKey");
      if (stored) {
        setApiKey(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading API key:", error);
    }
  };

  const saveApiKey = async (key: ApiKey) => {
    try {
      await AsyncStorage.setItem("apiKey", JSON.stringify(key));
      setApiKey(key);
    } catch (err) {
      console.error("Error saving API key:", err);
      error("Error", "Failed to save API key.");
    }
  };

  const addApiKey = async () => {
    if (!newKeyValue.trim()) {
      error("Error", "Please enter your Gemini API key.");
      return;
    }

    const newKey: ApiKey = {
      value: newKeyValue.trim(),
      createdAt: new Date().toISOString(),
    };

    await saveApiKey(newKey);

    setNewKeyValue("");
    setShowAddForm(false);
    success("Success", "Gemini API key added successfully!");
  };

  const deleteApiKey = () => {
    confirmDestructive(
      "Delete API Key",
      "Are you sure you want to delete this API key?",
      async () => {
        try {
          await AsyncStorage.removeItem("apiKey");
          setApiKey(null);
        } catch (err) {
          console.error("Error deleting API key:", err);
        }
      },
      undefined,
      "Delete",
    );
  };

  const maskApiKey = (value: string) => {
    if (value.length <= 8) return value;
    return value.substring(0, 4) + "..." + value.substring(value.length - 4);
  };

  const handleResetApp = async () => {
    confirmDestructive(
      "Reset App",
      "This will completely reset the app and delete ALL data including saved notes, API keys, settings, and onboarding status. This action cannot be undone!",
      async () => {
        try {
          // Show loading animation
          setIsResetting(true);

          // Clear all AsyncStorage data
          await AsyncStorage.clear();

          // Clear all saved notebooks from database
          await clearAllNotebooks();

          // Reset local state
          setApiKey(null);
          setNewKeyValue("");
          setShowAddForm(false);

          // Wait for animation to be visible
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Navigate to onboarding screen
          router.replace("/");
        } catch (err) {
          console.error("Error resetting app:", err);
          setIsResetting(false);
          error("Error", "Failed to reset app data. Please try again.");
        }
      },
      undefined,
      "Reset Everything",
    );
  };

  return (
    <>
      <ThemedView style={styles.container}>
        {isResetting && (
          <View
            style={[
              styles.resetLoadingOverlay,
              { backgroundColor: backgroundColor + "F0" },
            ]}
          >
            <View
              style={[
                styles.resetLoadingContent,
                { backgroundColor: cardBackground },
              ]}
            >
              <View style={styles.resetAnimationContainer}>
                <LottieView
                  source={require("../../assets/animations/Sushi.json")}
                  autoPlay
                  loop
                  style={styles.resetAnimation}
                />
              </View>
              <ThemedText style={[styles.resetTitle, { color: textColor }]}>
                Resetting App
              </ThemedText>
              <ThemedText
                style={[styles.resetSubtitle, { color: placeholderColor }]}
              >
                Clearing all data and preparing fresh start...
              </ThemedText>
            </View>
          </View>
        )}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Settings
          </ThemedText>
          <ThemedText
            style={[styles.headerSubtitle, { color: placeholderColor }]}
          >
            Manage your app preferences and API keys
          </ThemedText>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* API Keys Section */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Gemini API Key</ThemedText>

            {!apiKey ? (
              <>
                {!showAddForm ? (
                  <TouchableOpacity
                    style={[
                      styles.fullWidthButton,
                      { backgroundColor: tintColor },
                    ]}
                    onPress={() => setShowAddForm(true)}
                  >
                    <Ionicons name="add" size={20} color={backgroundColor} />
                    <ThemedText
                      style={[
                        styles.fullWidthButtonText,
                        { color: backgroundColor },
                      ]}
                    >
                      Add Gemini API Key
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.addForm,
                      {
                        backgroundColor: cardBackground,
                        borderColor: placeholderColor,
                      },
                    ]}
                  >
                    <ThemedText style={styles.instructionText}>
                      Enter your Gemini API key to enable AI note generation
                      features. Get your key from Google AI Studio at
                      https://makersuite.google.com/app/apikey
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        { color: textColor, borderColor: placeholderColor },
                      ]}
                      placeholder="Enter your Gemini API key"
                      placeholderTextColor={placeholderColor}
                      value={newKeyValue}
                      onChangeText={setNewKeyValue}
                      secureTextEntry
                    />
                    <View style={styles.formButtons}>
                      <TouchableOpacity
                        style={[
                          styles.cancelButton,
                          { borderColor: placeholderColor },
                        ]}
                        onPress={() => {
                          setShowAddForm(false);
                          setNewKeyValue("");
                        }}
                      >
                        <ThemedText style={styles.cancelButtonText}>
                          Cancel
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.saveButton,
                          { backgroundColor: tintColor },
                        ]}
                        onPress={addApiKey}
                      >
                        <ThemedText
                          style={[
                            styles.saveButtonText,
                            { color: backgroundColor },
                          ]}
                        >
                          Save
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View
                style={[
                  styles.keyItem,
                  {
                    backgroundColor: cardBackground,
                    borderColor: placeholderColor,
                  },
                ]}
              >
                <View style={styles.keyInfo}>
                  <ThemedText style={styles.keyName}>Gemini API Key</ThemedText>
                  <ThemedText style={styles.keyValue}>
                    {maskApiKey(apiKey.value)}
                  </ThemedText>
                  <ThemedText style={styles.keyDate}>
                    Added: {new Date(apiKey.createdAt).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText
                    style={[styles.keyDate, { color: tintColor, marginTop: 4 }]}
                  >
                    ✓ Ready to generate AI notes
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={deleteApiKey}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
            <ThemeToggler />
          </View>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Reset App</ThemedText>
            <ThemedButton
              title="Reset App"
              onPress={handleResetApp}
              style={styles.button}
            />
            <ThemedText style={styles.description}>
              This will completely reset the app and permanently delete ALL data
              including saved notes, API keys, settings, and preferences. This
              action cannot be undone.
            </ThemedText>
          </View>
        </ScrollView>
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  fullWidthButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  fullWidthButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },

  addForm: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
  },
  instructionText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  formButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  keyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  keyInfo: {
    flex: 1,
  },
  keyName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  keyValue: {
    fontSize: 14,
    opacity: 0.7,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  keyDate: {
    fontSize: 12,
    opacity: 0.5,
  },
  deleteButton: {
    padding: 8,
  },
  button: {
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
  },
  resetLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  resetLoadingContent: {
    paddingHorizontal: 40,
    paddingVertical: 50,
    borderRadius: 20,
    alignItems: "center",
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  resetAnimationContainer: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  resetAnimation: {
    width: "100%",
    height: "100%",
  },
  resetTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  resetSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.8,
  },
});

export default Settings;
