import { View, Text, Pressable, Modal } from "react-native";
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import type { GameStats } from "@/utils/gameStats";

/* ================================================================
   FEEDBACK SUMMARY – Player stats modal with glass-morphism
   ================================================================ */

/** Re-export for consumers */
export type FeedbackStats = GameStats;

type FeedbackSummaryProps = {
  visible: boolean;
  onClose: () => void;
  onPlayWithFriends: () => void;
  stats: FeedbackStats;
};

/** Small stat card used in the grid layout */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <View className="bg-white/[0.06] border border-white/10 rounded-xl p-3.5 items-center flex-1 min-w-[130px]">
      <Text className="text-2xl mb-1.5">{icon}</Text>
      <Text className="text-aqua text-lg font-black">{value}</Text>
      <Text className="text-muted text-[8px] tracking-widest font-black mt-1">
        {label}
      </Text>
    </View>
  );
}

export function FeedbackSummary({
  visible,
  onClose,
  onPlayWithFriends,
  stats,
}: FeedbackSummaryProps) {
  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  /** Animated entry for the card */
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
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        className="flex-1 bg-black/60 items-center justify-center px-6"
      >
        <Animated.View
          style={cardAnimStyle}
          className="w-full max-w-[380px] rounded-2xl border border-white/10 overflow-hidden"
        >
          {/* Glass-morphism background */}
          <View
            className="absolute inset-0 bg-ink/90"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 24,
            }}
          />
          <View className="absolute inset-0 bg-teal/10" />

          {/* Content */}
          <View className="relative p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-1">
                <Text className="text-muted text-[9px] tracking-widest font-black">
                  YOUR RECORD
                </Text>
                <Text className="text-cloud text-xl font-black tracking-wider">
                  YOUR STATS
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  handleClose();
                  setTimeout(onClose, 180);
                }}
                className="w-9 h-9 rounded-full bg-white/10 items-center justify-center border border-white/10"
              >
                <Text className="text-cloud text-sm font-black">✕</Text>
              </Pressable>
            </View>

            {/* Win Rate Bar */}
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-muted text-[9px] tracking-widest font-black">
                  WIN RATE
                </Text>
                <Text className="text-gold text-sm font-black">
                  {winRate}%
                </Text>
              </View>
              <View className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${winRate}%` }}
                />
              </View>
              <View className="flex-row justify-between mt-1.5">
                <Text className="text-muted text-[8px] font-black">
                  {stats.gamesWon} W
                </Text>
                <Text className="text-muted text-[8px] font-black">
                  {stats.gamesPlayed - stats.gamesWon} L
                </Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View className="flex-row flex-wrap gap-2.5 mb-5">
              <StatCard icon="🎮" label="GAMES PLAYED" value={stats.gamesPlayed} />
              <StatCard icon="🏆" label="GAMES WON" value={stats.gamesWon} />
              <StatCard icon="💀" label="LOSSES" value={stats.loserCount} />
              <StatCard icon="⚠️" label="THULLAS HIT" value={stats.thullaCount} />
              <StatCard icon="🛡️" label="TIMES SAFE" value={stats.safeCount} />
              <StatCard icon="🔥" label="BEST STREAK" value={stats.longestStreak} />
            </View>

            {/* Favorite Card */}
            <View className="bg-white/[0.04] rounded-xl px-4 py-3 border border-white/10 mb-5 flex-row items-center justify-between">
              <Text className="text-muted text-[9px] tracking-widest font-black">
                FAVORITE CARD
              </Text>
              <Text className="text-gold text-sm font-black">
                {stats.favoriteCard}
              </Text>
            </View>

            {/* Action Buttons */}
            <Pressable
              onPress={() => {
                handleClose();
                setTimeout(onPlayWithFriends, 180);
              }}
              className="py-4 rounded-xl items-center mb-3"
              style={{
                backgroundColor: "#F5C96A",
                shadowColor: "#F5C96A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Text className="text-ink text-[11px] font-black tracking-wider">
                PLAY WITH FRIENDS →
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                handleClose();
                setTimeout(onClose, 180);
              }}
              className="py-3.5 rounded-xl items-center border border-white/10"
            >
              <Text className="text-cloud text-[11px] font-bold tracking-wider">
                CLOSE
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
