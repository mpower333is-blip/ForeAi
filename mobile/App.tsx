import "react-native-gesture-handler";
import React from "react";
import { Text, View, StatusBar, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RoundProvider } from "./src/state/RoundContext";
import { TournamentProvider } from "./src/state/TournamentContext";
import { GamesProvider } from "./src/state/GamesContext";
import { PlanProvider, usePlan } from "./src/state/PlanContext";
import { ProfileProvider, useProfile } from "./src/state/ProfileContext";
import { CourseCoordsProvider } from "./src/state/CourseCoordsContext";
import { UpgradeGate } from "./src/components/Upsell";
import WatchShotSync from "./src/components/WatchShotSync";
import { FeatureKey } from "./src/config/appConfig";
import { APP_NAME } from "./src/config/appVariant";
import { colors } from "./src/theme";

import Onboarding from "./src/screens/Onboarding";
import OnCourseScreen from "./src/screens/OnCourseScreen";

import HomeScreen from "./src/screens/HomeScreen";
import PlayScreen from "./src/screens/PlayScreen";
import CaddieScreen from "./src/screens/CaddieScreen";
import SwingScreen from "./src/screens/SwingScreen";
import EventsScreen from "./src/screens/EventsScreen";
import StrategyScreen from "./src/screens/StrategyScreen";
import StatsScreen from "./src/screens/StatsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CourseSelectScreen from "./src/screens/CourseSelectScreen";
import CoursePreviewScreen from "./src/screens/CoursePreviewScreen";
import GamesScreen from "./src/screens/GamesScreen";
import UpgradeScreen from "./src/screens/UpgradeScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Wrap a Pro-only screen: show it when unlocked, otherwise the upgrade gate.
// Keeps the demo build free for Caddie, Coach and Events while everything else
// prompts to buy the full package.
function locked(Comp: React.ComponentType<any>, feature: FeatureKey) {
  return function Gated(props: any) {
    const { hasFeature } = usePlan();
    return hasFeature(feature) ? (
      <Comp {...props} />
    ) : (
      <UpgradeGate feature={feature} navigation={props.navigation} />
    );
  };
}

const ICONS: Record<string, string> = {
  Home: "⛳",
  Play: "🏌️",
  Course: "📍",
  Coach: "🎥",
  Caddie: "🎒",
  Events: "🏆",
  Profile: "👤",
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 66,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color, focused }) => (
          <Text style={{ fontSize: focused ? 22 : 19, color, opacity: focused ? 1 : 0.85 }}>
            {ICONS[route.name] ?? "•"}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Play" component={locked(PlayScreen, "round")} options={{ title: "Round" }} />
      <Tab.Screen name="Coach" component={SwingScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Decides between a loading splash, the first-run onboarding, and the main app.
function Root() {
  const { ready, onboarded } = useProfile();
  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashBrand}>{APP_NAME}</Text>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!onboarded) return <Onboarding />;
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerShown: false, // pushed screens carry their own ScreenHeader with a back arrow
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} />
        {/* Nested feature screens (surfaced from Home cards, the Round screen and
            the Profile hub). Registered in both builds — the event build is fully
            unlocked, so the Round screen's links to these all work on the day. */}
        <Stack.Screen name="Caddie" component={CaddieScreen} />
        <Stack.Screen name="Stats" component={locked(StatsScreen, "stats")} />
        <Stack.Screen name="Strategy" component={locked(StrategyScreen, "strategy")} />
        <Stack.Screen name="Games" component={locked(GamesScreen, "games")} />
        {/* On-course GPS + coordinate survey, reachable from Home in the full app
            (it's also the "Course" tab in the event app). */}
        <Stack.Screen name="Survey" component={OnCourseScreen} />
        <Stack.Screen name="CourseSelect" component={CourseSelectScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
        {/* Keeps the native header (it has no in-screen ScreenHeader). */}
        <Stack.Screen name="CoursePreview" component={CoursePreviewScreen} options={{ headerShown: true, title: "Course Preview" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <ProfileProvider>
        <CourseCoordsProvider>
        <RoundProvider>
          <TournamentProvider>
            {/* Plan sits inside Tournament so a live golf day can unlock the
                full app "for the day" (see PlanContext). */}
            <PlanProvider>
              <GamesProvider>
                <WatchShotSync />
                <Root />
              </GamesProvider>
            </PlanProvider>
          </TournamentProvider>
        </RoundProvider>
        </CourseCoordsProvider>
        </ProfileProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 16 },
  splashBrand: { color: colors.accent, fontSize: 44, fontWeight: "800", letterSpacing: -1 },
});
