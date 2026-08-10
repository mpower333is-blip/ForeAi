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
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20, color }}>{ICONS[route.name] ?? "•"}</Text>
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
              </Stack.Navigator>
            </NavigationContainer>
          </TournamentProvider>
        </RoundProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
