import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

const { width: screenWidth } = Dimensions.get("window");

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface ThemedAlertProps {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

export function ThemedAlert({
  visible,
  title,
  message,
  buttons = [{ text: "OK", style: "default" }],
  onDismiss,
  icon,
  iconColor,
}: ThemedAlertProps) {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const placeholderColor = useThemeColor({}, "icon");

  // Animation values
  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.8);
  const modalOpacity = useSharedValue(0);

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: modalOpacity.value,
  }));

  React.useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      modalScale.value = withSpring(1, {
        damping: 20,
        stiffness: 300,
      });
      modalOpacity.value = withTiming(1, { duration: 200 });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 150 });
      modalScale.value = withTiming(0.8, { duration: 150 });
      modalOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, overlayOpacity, modalScale, modalOpacity]);

  const handleButtonPress = (button: AlertButton) => {
    // Animate out first, then call the button's onPress
    overlayOpacity.value = withTiming(0, { duration: 150 });
    modalScale.value = withTiming(0.8, { duration: 150 });
    modalOpacity.value = withTiming(0, { duration: 150 }, () => {
      if (button.onPress) {
        runOnJS(button.onPress)();
      }
      if (onDismiss) {
        runOnJS(onDismiss)();
      }
    });
  };

  const handleOverlayPress = () => {
    // Only dismiss if there's a cancel button or onDismiss is provided
    const cancelButton = buttons.find((b) => b.style === "cancel");
    if (cancelButton) {
      handleButtonPress(cancelButton);
    } else if (onDismiss) {
      overlayOpacity.value = withTiming(0, { duration: 150 });
      modalScale.value = withTiming(0.8, { duration: 150 });
      modalOpacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(onDismiss)();
      });
    }
  };

  const getButtonColor = (buttonStyle: AlertButton["style"]) => {
    switch (buttonStyle) {
      case "destructive":
        return "#FF4444";
      case "cancel":
        return placeholderColor;
      default:
        return tintColor;
    }
  };

  const getButtonTextWeight = (buttonStyle: AlertButton["style"]) => {
    return buttonStyle === "cancel" ? "500" : "600";
  };

  if (!visible) return null;

  return (
    <View
      style={styles.absoluteContainer}
      pointerEvents={visible ? "auto" : "none"}
    >
      <TouchableWithoutFeedback onPress={handleOverlayPress}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                modalStyle,
                { backgroundColor: backgroundColor },
              ]}
            >
              <ThemedView style={styles.modal}>
                {/* Icon */}
                {icon && (
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={icon}
                      size={32}
                      color={iconColor || tintColor}
                    />
                  </View>
                )}

                {/* Title */}
                {title && (
                  <ThemedText style={[styles.title, { color: textColor }]}>
                    {title}
                  </ThemedText>
                )}

                {/* Message */}
                {message && (
                  <ThemedText style={[styles.message, { color: textColor }]}>
                    {message}
                  </ThemedText>
                )}

                {/* Buttons */}
                <View
                  style={[
                    styles.buttonContainer,
                    buttons.length > 2 && styles.verticalButtons,
                  ]}
                >
                  {buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        buttons.length === 1 && styles.singleButton,
                        buttons.length === 2 && styles.doubleButton,
                        buttons.length > 2 && styles.verticalButton,
                        index === buttons.length - 1 &&
                          buttons.length > 2 &&
                          styles.lastVerticalButton,
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.buttonText,
                          {
                            color: getButtonColor(button.style),
                            fontWeight: getButtonTextWeight(button.style),
                          },
                        ]}
                      >
                        {button.text}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ThemedView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    borderRadius: 20,
    minWidth: Math.min(screenWidth - 40, 300),
    maxWidth: screenWidth - 40,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  modal: {
    padding: 24,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 50,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    opacity: 0.9,
  },
  buttonContainer: {
    flexDirection: "row",
    width: "100%",
  },
  verticalButtons: {
    flexDirection: "column",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  singleButton: {
    flex: 1,
  },
  doubleButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  verticalButton: {
    width: "100%",
    marginVertical: 4,
  },
  lastVerticalButton: {
    marginBottom: 0,
  },
  buttonText: {
    fontSize: 16,
    textAlign: "center",
  },
});
