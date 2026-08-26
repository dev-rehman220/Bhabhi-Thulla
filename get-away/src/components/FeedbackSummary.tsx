import { View, Text, Pressable, Modal, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import type { GameStats } from "@/utils/gameStats";

export type FeedbackStats = GameStats;

type FeedbackSummaryProps = {
  visible: boolean;
  onClose: () => void;
  onPlayWithFriends: () => void;
  stats: GameStats;
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

function StatCard({ icon, label, value, w }: { icon: string; label: string; value: string | number; w: number }) {
  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, alignItems: "center", flex: 1, minWidth: Math.max(100, w * 0.13) }}>
      <Text style={{ fontSize: 20, marginBottom: 6 }}>{icon}</Text>
      <Text style={{ color: T.accent, fontSize: w > 500 ? 18 : 16, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: T.textMuted, fontSize: w > 500 ? 9 : 8, letterSpacing: 1, fontWeight: "900", marginTop: 4 }}>{label}</Text>
    </View>
  );
}

export function FeedbackSummary({ visible, onClose, onPlayWithFriends, stats }: FeedbackSummaryProps) {
  const { width } = useWindowDimensions();
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const handleOpen = () => {
    cardScale.value = withSpring(1, { damping: 14, stiffness: 180 });
    cardOpacity.value = withSpring(1, { damping: 14, stiffness: 180 });
  };

  const handleClose = () => {
    cardScale.value = withSpring(0.92, { damping: 18, stiffness: 200 });
    cardOpacity.value = withSpring(0, { damping: 18, stiffness: 200 });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onShow={handleOpen} onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}
      >
        <Animated.View
          style={[cardAnimStyle, { width: "100%", maxWidth: 400, borderRadius: 16, borderWidth: 1, borderColor: T.border, overflow: "hidden" }]}
        >
          {/* Background */}
          <View style={{ position: "absolute", inset: 0, backgroundColor: T.surface }} />
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(52,211,153,0.05)" }} />

          {/* Content */}
          <View style={{ position: "relative", padding: 24 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textMuted, fontSize: 9, letterSpacing: 1, fontWeight: "900" }}>YOUR RECORD</Text>
                <Text style={{ color: T.text, fontSize: 20, fontWeight: "900", letterSpacing: 1 }}>YOUR STATS</Text>
              </View>
              <Pressable
                onPress={() => { handleClose(); setTimeout(onClose, 180); }}
                style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: "rgba(232,245,238,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.border }}
              >
                <Text style={{ color: T.text, fontSize: 14, fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>

            {/* Win Rate Bar */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: T.textMuted, fontSize: 9, letterSpacing: 1, fontWeight: "900" }}>WIN RATE</Text>
                <Text style={{ color: T.gold, fontSize: 14, fontWeight: "900" }}>{winRate}%</Text>
              </View>
              <View style={{ width: "100%", height: 10, backgroundColor: "rgba(232,245,238,0.1)", borderRadius: 999, overflow: "hidden" }}>
                <View style={{ height: "100%", borderRadius: 999, backgroundColor: T.gold, width: `${winRate}%` }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ color: T.textMuted, fontSize: 8, fontWeight: "900" }}>{stats.gamesWon} W</Text>
                <Text style={{ color: T.textMuted, fontSize: 8, fontWeight: "900" }}>{stats.gamesPlayed - stats.gamesWon} L</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <StatCard icon="🎮" label="GAMES" value={stats.gamesPlayed} w={width} />
              <StatCard icon="🏆" label="WON" value={stats.gamesWon} w={width} />
              <StatCard icon="💀" label="LOSSES" value={stats.loserCount} w={width} />
              <StatCard icon="⚠️" label="THULLAS" value={stats.thullaCount} w={width} />
              <StatCard icon="🛡️" label="SAFE" value={stats.safeCount} w={width} />
              <StatCard icon="🔥" label="STREAK" value={stats.longestStreak} w={width} />
            </View>

            {/* Favorite Card */}
            <View style={{ backgroundColor: "rgba(232,245,238,0.03)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: T.border, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: T.textMuted, fontSize: 9, letterSpacing: 1, fontWeight: "900" }}>FAVORITE CARD</Text>
              <Text style={{ color: T.gold, fontSize: 14, fontWeight: "900" }}>{stats.favoriteCard}</Text>
            </View>

            {/* Action Buttons */}
            <Pressable
              onPress={() => { handleClose(); setTimeout(onPlayWithFriends, 180); }}
              style={{ paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 12, backgroundColor: T.gold, shadowColor: "#D4A843", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
            >
              <Text style={{ color: T.bg, fontSize: width > 500 ? 11 : 10, fontWeight: "900", letterSpacing: 1 }}>PLAY WITH FRIENDS →</Text>
            </Pressable>

            <Pressable
              onPress={() => { handleClose(); setTimeout(onClose, 180); }}
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: T.border }}
            >
              <Text style={{ color: T.text, fontSize: width > 500 ? 11 : 10, fontWeight: "700", letterSpacing: 1 }}>CLOSE</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
