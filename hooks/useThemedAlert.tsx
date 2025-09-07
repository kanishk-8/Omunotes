import React, { useState, useCallback } from "react";
import { ThemedAlert, AlertButton } from "@/components/ThemedAlert";

interface AlertConfig {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  iconColor?: string;
}

export function useThemedAlert() {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertConfig(config);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    // Clear config after animation completes
    setTimeout(() => setAlertConfig(null), 200);
  }, []);

  // Convenience methods for common alert types
  const alert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      showAlert({
        title,
        message,
        buttons: buttons || [{ text: "OK", style: "default" }],
      });
    },
    [showAlert],
  );

  const confirm = useCallback(
    (
      title: string,
      message?: string,
      onConfirm?: () => void,
      onCancel?: () => void,
    ) => {
      showAlert({
        title,
        message,
        buttons: [
          { text: "Cancel", style: "cancel", onPress: onCancel },
          { text: "Confirm", style: "default", onPress: onConfirm },
        ],
      });
    },
    [showAlert],
  );

  const confirmDestructive = useCallback(
    (
      title: string,
      message?: string,
      onConfirm?: () => void,
      onCancel?: () => void,
      confirmText: string = "Delete",
    ) => {
      showAlert({
        title,
        message,
        icon: "warning",
        iconColor: "#FF4444",
        buttons: [
          { text: "Cancel", style: "cancel", onPress: onCancel },
          {
            text: confirmText,
            style: "destructive",
            onPress: onConfirm,
          },
        ],
      });
    },
    [showAlert],
  );

  const success = useCallback(
    (title: string, message?: string, onPress?: () => void) => {
      showAlert({
        title,
        message,
        icon: "checkmark-circle",
        iconColor: "#4CAF50",
        buttons: [{ text: "OK", style: "default", onPress }],
      });
    },
    [showAlert],
  );

  const error = useCallback(
    (title: string, message?: string, onPress?: () => void) => {
      showAlert({
        title,
        message,
        icon: "alert-circle",
        iconColor: "#FF4444",
        buttons: [{ text: "OK", style: "default", onPress }],
      });
    },
    [showAlert],
  );

  const info = useCallback(
    (title: string, message?: string, onPress?: () => void) => {
      showAlert({
        title,
        message,
        icon: "information-circle",
        buttons: [{ text: "OK", style: "default", onPress }],
      });
    },
    [showAlert],
  );

  const AlertComponent = () => {
    if (!alertConfig) return null;

    return (
      <ThemedAlert
        visible={visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
        onDismiss={hideAlert}
      />
    );
  };

  return {
    showAlert,
    hideAlert,
    alert,
    confirm,
    confirmDestructive,
    success,
    error,
    info,
    AlertComponent,
  };
}
