import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemedButton } from "@/components/ThemedButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useRouter } from "expo-router";
import { ThemeToggler } from "@/components/ThemeToggler";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { ApiKey } from "@/types/notes";

const Settings = () => {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);

  const [newKeyValue, setNewKeyValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const placeholderColor = useThemeColor({}, "icon");
  const tintColor = useThemeColor({}, "tint");
  const cardBackground = useThemeColor({}, "background");

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
    } catch (error) {
      console.error("Error saving API key:", error);
      Alert.alert("Error", "Failed to save API key.");
    }
  };

  const addApiKey = async () => {
    if (!newKeyValue.trim()) {
      Alert.alert("Error", "Please enter your Gemini API key.");
      return;
    }

    const newKey: ApiKey = {
      value: newKeyValue.trim(),
      createdAt: new Date().toISOString(),
    };

    await saveApiKey(newKey);

    setNewKeyValue("");
    setShowAddForm(false);
    Alert.alert("Success", "Gemini API key added successfully!");
  };

  const deleteApiKey = () => {
    Alert.alert(
      "Delete API Key",
      "Are you sure you want to delete this API key?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("apiKey");
              setApiKey(null);
            } catch (error) {
              console.error("Error deleting API key:", error);
            }
          },
        },
      ],
    );
  };

  const maskApiKey = (value: string) => {
    if (value.length <= 8) return value;
    return value.substring(0, 4) + "..." + value.substring(value.length - 4);
  };

  const handleResetApp = async () => {
    Alert.alert(
      "Reset App",
      "This will completely reset the app and delete ALL data including saved notes, API keys, settings, and onboarding status. This action cannot be undone!",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear all AsyncStorage data
              await AsyncStorage.clear();

              // Reset local state
              setApiKey(null);
              setNewKeyValue("");
              setShowAddForm(false);

              Alert.alert(
                "App Reset Complete",
                "All app data has been cleared. The app will now restart with onboarding.",
                [
                  {
                    text: "Start Fresh",
                    onPress: () => router.replace("/onboarding"),
                  },
                ],
              );
            } catch (error) {
              console.error("Error resetting app:", error);
              Alert.alert(
                "Error",
                "Failed to reset app data. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
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
});

export default Settings;
