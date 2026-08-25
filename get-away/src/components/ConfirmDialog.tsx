import { View, Text, Pressable, Modal } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

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
  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        className="flex-1 bg-black/60 items-center justify-center px-8"
      >
        <View
          className="bg-ink border border-white/10 rounded-2xl p-6 w-full max-w-sm"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 24,
          }}
        >
          <Text className="text-cloud text-lg font-bold tracking-wide">
            {title}
          </Text>
          <Text className="text-muted text-sm mt-3 leading-5">{message}</Text>
          <View className="flex-row gap-3 mt-6">
            <Pressable
              onPress={onCancel}
              className="flex-1 py-3.5 rounded-xl border border-white/10 items-center active:opacity-70"
            >
              <Text className="text-cloud text-xs font-bold tracking-wider">
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className={`flex-1 py-3.5 rounded-xl items-center active:opacity-80 ${
                destructive ? "bg-coral" : "bg-gold"
              }`}
            >
              <Text
                className={`text-xs font-bold tracking-wider ${
                  destructive ? "text-white" : "text-ink"
                }`}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
