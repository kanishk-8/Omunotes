import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import LottieView from "lottie-react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: screenWidth } = Dimensions.get("window");

interface OnboardingSlide {
  id: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
}

const onboardingData: OnboardingSlide[] = [
  {
    id: 1,
    icon: "sparkles",
    title: "Welcome to Omunotes",
    subtitle: "AI-Powered Note Taking",
    description:
      "Transform your files, images, and ideas into structured, intelligent notes with the power of AI.",
    features: [
      "Upload any file format",
      "Capture images and documents",
      "AI-generated structured content",
      "Smart organization",
    ],
  },
  {
    id: 2,
    icon: "cloud-upload",
    title: "Upload Anything",
    subtitle: "Files, Photos & More",
    description:
      "Upload documents, images, or take photos. Our AI will analyze and extract meaningful content.",
    features: [
      "Camera integration",
      "Document scanning",
      "Multiple file formats",
      "Instant processing",
    ],
  },
  {
    id: 3,
    icon: "bulb",
    title: "AI Processing",
    subtitle: "Powered by Gemini AI",
    description:
      "Advanced AI analyzes your content and generates comprehensive, structured notes automatically.",
    features: [
      "Content analysis",
      "Structure generation",
      "Image recognition",
      "Smart summaries",
    ],
  },
  {
    id: 4,
    icon: "library",
    title: "Organize & Save",
    subtitle: "Your Digital Library",
    description:
      "All your AI-generated notes are saved and organized for easy access and review anytime.",
    features: [
      "Auto-save notes",
      "Search functionality",
      "Category organization",
      "Offline access",
    ],
  },
];

const OnboardingScreen = () => {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const iconColor = useThemeColor({}, "icon");

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem(
          "hasCompletedOnboarding",
        );
        if (hasCompletedOnboarding) {
          router.replace("/(tabs)/home");
          return;
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [router]);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem("hasCompletedOnboarding", "true");
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Error saving onboarding completion:", error);
    }
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const slideIndex = Math.round(offsetX / screenWidth);

    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);

      // Animate slide transition
      Animated.spring(slideAnimation, {
        toValue: slideIndex,
        useNativeDriver: true,
      }).start();
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
  };

  const nextSlide = () => {
    if (currentSlide < onboardingData.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      handleGetStarted();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  };

  const renderSlide = (slide: OnboardingSlide, index: number) => (
    <View key={slide.id} style={[styles.slide, { width: screenWidth }]}>
      <View style={styles.slideContent}>
        {/* Icon or Animation */}
        {index === 0 ? (
          <View style={styles.animationContainer}>
            <LottieView
              source={require("../assets/animations/Sushi.json")}
              autoPlay
              loop
              style={styles.lottieAnimation}
            />
          </View>
        ) : (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${tintColor}20` },
            ]}
          >
            <Ionicons name={slide.icon} size={60} color={tintColor} />
          </View>
        )}

        {/* Title */}
        <ThemedText style={[styles.title, { color: textColor }]}>
          {slide.title}
        </ThemedText>

        {/* Subtitle */}
        <ThemedText style={[styles.subtitle, { color: tintColor }]}>
          {slide.subtitle}
        </ThemedText>

        {/* Description */}
        <ThemedText style={[styles.description, { color: iconColor }]}>
          {slide.description}
        </ThemedText>

        {/* Features */}
        <View
          style={[
            styles.featuresContainer,
            {
              backgroundColor: `${tintColor}10`,
              borderColor: `${tintColor}30`,
            },
          ]}
        >
          <ThemedText style={[styles.featuresTitle, { color: tintColor }]}>
            ✨ Key Features
          </ThemedText>
          {slide.features.map((feature, featureIndex) => (
            <View key={featureIndex} style={styles.featureItem}>
              <View
                style={[
                  styles.checkmarkContainer,
                  { backgroundColor: tintColor },
                ]}
              >
                <Ionicons name="checkmark" size={12} color="white" />
              </View>
              <ThemedText style={[styles.featureText, { color: textColor }]}>
                {feature}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      {onboardingData.map((_, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.paginationDot,
            {
              backgroundColor:
                index === currentSlide ? tintColor : `${iconColor}30`,
              width: index === currentSlide ? 24 : 8,
            },
          ]}
          onPress={() => goToSlide(index)}
        />
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <LottieView
            source={require("../assets/animations/Sushi.json")}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
          <ThemedText style={[styles.loadingText, { color: textColor }]}>
            Loading...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleGetStarted}>
        <ThemedText style={[styles.skipText, { color: iconColor }]}>
          Skip
        </ThemedText>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {onboardingData.map((slide, index) => renderSlide(slide, index))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Pagination */}
        {renderPagination()}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {currentSlide > 0 ? (
            <TouchableOpacity
              style={[styles.navButton, { backgroundColor: `${iconColor}20` }]}
              onPress={prevSlide}
            >
              <Ionicons name="chevron-back" size={20} color={iconColor} />
              <ThemedText style={[styles.navButtonText, { color: iconColor }]}>
                Previous
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={styles.navButton} />
          )}

          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: tintColor }]}
            onPress={nextSlide}
          >
            <ThemedText
              style={[styles.navButtonText, { color: backgroundColor }]}
            >
              {currentSlide === onboardingData.length - 1
                ? "Get Started"
                : "Next"}
            </ThemedText>
            <Ionicons
              name={
                currentSlide === onboardingData.length - 1
                  ? "checkmark"
                  : "chevron-forward"
              }
              size={20}
              color={backgroundColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Background Decoration */}
      <View
        style={[
          styles.backgroundDecoration,
          styles.decoration1,
          { backgroundColor: `${tintColor}10` },
        ]}
      />
      <View
        style={[
          styles.backgroundDecoration,
          styles.decoration2,
          { backgroundColor: `${tintColor}05` },
        ]}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  skipButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 30,
    paddingBottom: 140,
  },
  slideContent: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingTop: 140,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    opacity: 0.8,
    paddingHorizontal: 10,
  },
  featuresContainer: {
    width: "100%",
    marginTop: 15,
    marginBottom: 20,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  checkmarkContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
    fontWeight: "500",
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: "center",
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  animationContainer: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 40,
  },
  lottieAnimation: {
    width: 140,
    height: 140,
  },
  backgroundDecoration: {
    position: "absolute",
    borderRadius: 100,
  },
  decoration1: {
    width: 200,
    height: 200,
    top: 100,
    right: -50,
    opacity: 0.3,
  },
  decoration2: {
    width: 150,
    height: 150,
    bottom: 200,
    left: -30,
    opacity: 0.2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingAnimation: {
    width: 200,
    height: 200,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "500",
    marginTop: 20,
    opacity: 0.8,
  },
});

export default OnboardingScreen;
