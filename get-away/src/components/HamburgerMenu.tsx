import { useState, useCallback } from "react";
import { Pressable, View, Text, Modal } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

export type MenuItem = {
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
};

type HamburgerMenuProps = {
  items: MenuItem[];
};

export function HamburgerMenu({ items }: HamburgerMenuProps) {
  const [visible, setVisible] = useState(false);

  const handleItemPress = useCallback((onPress: () => void) => {
    setVisible(false);
    setTimeout(onPress, 150);
  }, []);

  return (
    <View>
      <Pressable
        onPress={() => setVisible(true)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: "rgba(232,245,238,0.1)",
          borderWidth: 1,
          borderColor: "rgba(232,245,238,0.1)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ gap: 3, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 20, height: 2, backgroundColor: "#D4A843", borderRadius: 999 }} />
          <View style={{ width: 20, height: 2, backgroundColor: "#D4A843", borderRadius: 999 }} />
          <View style={{ width: 20, height: 2, backgroundColor: "#D4A843", borderRadius: 999 }} />
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setVisible(false)}
        >
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              marginTop: 56,
              marginRight: 16,
              width: 208,
              backgroundColor: "rgba(7, 21, 37, 0.97)",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 24,
              zIndex: 999,
            }}
          >
            <View style={{ padding: 6 }}>
              {items.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleItemPress(item.onPress)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ fontSize: 16, width: 24, textAlign: "center" }}>
                    {item.icon}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      letterSpacing: 0.5,
                      color: item.destructive ? "#F27C68" : "#F5F1E8",
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}
