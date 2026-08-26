import { View, Text, Pressable, Modal } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useWindowDimensions } from "react-native";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const T = {
  bg: "#060F0A",
  surface: "#0C1B12",
  card: "#122B1A",
  accent: "#34D399",
  gold: "#D4A843",
  coral: "#E8605A",
  text: "#E8F5EE",
  textMuted: "#7CAA92",
  textDim: "#3A6B50",
  border: "#1A3526",
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { width } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        <View
          style={{
            backgroundColor: T.surface,
            borderWidth: 1,
            borderColor: "rgba(232,245,238,0.1)",
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 400,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 24,
          }}
        >
          <Text style={{ color: T.text, fontSize: width > 500 ? 18 : 16, fontWeight: "900", letterSpacing: 0.5 }}>{title}</Text>
          <Text style={{ color: T.textMuted, fontSize: width > 500 ? 14 : 13, marginTop: 12, lineHeight: 22 }}>{message}</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <Pressable
              onPress={onCancel}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(232,245,238,0.1)", alignItems: "center" }}
            >
              <Text style={{ color: T.text, fontSize: width > 500 ? 12 : 11, fontWeight: "900", letterSpacing: 0.15 * 10 }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: destructive ? T.coral : T.gold,
              }}
            >
              <Text style={{ color: destructive ? T.text : T.bg, fontSize: width > 500 ? 12 : 11, fontWeight: "900", letterSpacing: 0.15 * 10 }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
