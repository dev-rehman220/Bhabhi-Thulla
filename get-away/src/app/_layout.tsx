import "@/global.css";
import { useEffect, Component, type ReactNode } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { soundManager } from "@/utils/soundManager";

SplashScreen.preventAutoHideAsync();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message ?? "Something went wrong" };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-ink items-center justify-center px-8">
          <Text className="text-coral text-2xl font-black mb-2">
            Oops!
          </Text>
          <Text className="text-muted text-sm text-center mb-6">
            {this.state.error}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: "" })}
            onPressIn={() => soundManager.play("buttonPress")}
            className="bg-gold rounded-xl px-8 py-3"
          >
            <Text className="text-ink text-xs font-black tracking-wider">
              TRY AGAIN
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden");
    }
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar hidden />
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
