import "react-native-gesture-handler";
import React from "react";
import { Text, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RoundProvider } from "./src/state/RoundContext";
import { TournamentProvider } from "./src/state/TournamentContext";
import { GamesProvider } from "./src/state/GamesContext";
import { PlanProvider, usePlan } from "./src/state/PlanContext";
import { UpgradeGate } from "./src/components/Upsell";
import { FeatureKey } from "./src/config/appConfig";
import { colors } from "./src/theme";

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
  Caddie: "🎒",
  Coach: "🎥",
  Events: "🏆",
  Stats: "📊",
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
      <Tab.Screen name="Caddie" component={CaddieScreen} />
      <Tab.Screen name="Coach" component={SwingScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Stats" component={locked(StatsScreen, "stats")} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <PlanProvider>
        <RoundProvider>
          <TournamentProvider>
            <GamesProvider>
            <NavigationContainer theme={navTheme}>
              <Stack.Navigator
                screenOptions={{
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.text,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
                <Stack.Screen name="Strategy" component={locked(StrategyScreen, "strategy")} options={{ title: "Course Strategy" }} />
                <Stack.Screen name="CourseSelect" component={CourseSelectScreen} options={{ title: "Choose Course" }} />
                <Stack.Screen name="CoursePreview" component={CoursePreviewScreen} options={{ title: "Course Preview" }} />
                <Stack.Screen name="Games" component={locked(GamesScreen, "games")} options={{ title: "Range Games" }} />
                <Stack.Screen name="Upgrade" component={UpgradeScreen} options={{ title: "ForeAi Pro" }} />
              </Stack.Navigator>
            </NavigationContainer>
            </GamesProvider>
          </TournamentProvider>
        </RoundProvider>
        </PlanProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
