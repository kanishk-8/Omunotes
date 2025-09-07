import AsyncStorage from "@react-native-async-storage/async-storage";

import { useState, useEffect } from "react";
import { useRouter, Tabs } from "expo-router";
import { HapticTab } from "@/components/HapticTab";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem(
          "hasCompletedOnboarding",
        );
        if (!hasCompletedOnboarding) {
          router.replace("/onboarding");
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [router]);

  if (isLoading) {
    return null;
  }
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarButton: HapticTab,
        tabBarIconStyle: { marginTop: 6 },
        tabBarStyle: {
          height: 70,
          paddingTop: 8,
        },
        headerTitleStyle: {
          fontSize: 40,
          padding: 10,
        },
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].background,
          height: 120,
          shadowColor: "transparent",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Notes",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => {
            return (
              <FontAwesome6
                name="book-bookmark"
                size={focused ? 26 : 24}
                color={color}
              />
            );
          },
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create Notes",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => {
            return (
              <FontAwesome6
                name="wand-magic-sparkles"
                size={focused ? 26 : 24}
                color={color}
              />
            );
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => {
            return (
              <Ionicons
                name="settings"
                size={focused ? 26 : 24}
                color={color}
              />
            );
          },
        }}
      />
    </Tabs>
  );
}
