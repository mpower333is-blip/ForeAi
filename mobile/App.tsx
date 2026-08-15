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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
      <Tab.Screen name="Play" component={PlayScreen} options={{ title: "Round" }} />
      <Tab.Screen name="Caddie" component={CaddieScreen} />
      <Tab.Screen name="Coach" component={SwingScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
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
                <Stack.Screen name="Strategy" component={StrategyScreen} options={{ title: "Course Strategy" }} />
                <Stack.Screen name="CourseSelect" component={CourseSelectScreen} options={{ title: "Choose Course" }} />
                <Stack.Screen name="CoursePreview" component={CoursePreviewScreen} options={{ title: "Course Preview" }} />
                <Stack.Screen name="Games" component={GamesScreen} options={{ title: "Range Games" }} />
              </Stack.Navigator>
            </NavigationContainer>
            </GamesProvider>
          </TournamentProvider>
        </RoundProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
