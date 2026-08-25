import "@/global.css";
import { useEffect, useState, Component, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
