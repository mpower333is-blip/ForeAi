import React from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { radius } from "../theme";

// Wraps a hole view (satellite image + overlays) and makes it pinch-to-zoom,
// pannable and double-tap-to-zoom, so you can explore how the hole plays.
// Everything scales together, so the distance markers and route line stay
// aligned to the photo. Resets whenever `resetKey` changes (e.g. new hole).
const MAX = 4;

export default function ZoomableHole({
  children,
  resetKey,
}: {
  children: React.ReactNode;
  resetKey?: string | number;
}) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const stx = useSharedValue(0);
  const sty = useSharedValue(0);

  const reset = (animate = true) => {
    "worklet";
    scale.value = animate ? withTiming(1) : 1;
    saved.value = 1;
    tx.value = animate ? withTiming(0) : 0;
    ty.value = animate ? withTiming(0) : 0;
    stx.value = 0;
    sty.value = 0;
  };

  // New hole → back to fit.
  React.useEffect(() => { reset(false); }, [resetKey]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value <= 1.01) reset();
    });

  const pan = Gesture.Pan()
    // When not zoomed, let the drag through so the page can still scroll over
    // the image; only pan the hole once zoomed in.
    .onTouchesMove((_e, state) => {
      if (scale.value <= 1) state.fail();
    })
    .onUpdate((e) => {
      tx.value = stx.value + e.translationX;
      ty.value = sty.value + e.translationY;
    })
    .onEnd(() => {
      stx.value = tx.value;
      sty.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) reset();
      else {
        scale.value = withTiming(2.2);
        saved.value = 2.2;
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={styles.clip}>
        <Animated.View style={animStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", borderRadius: radius.lg },
});
