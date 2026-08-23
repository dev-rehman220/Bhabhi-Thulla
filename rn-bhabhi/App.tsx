import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import HowToPlayScreen from './src/screens/HowToPlayScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import GameScreen from './src/screens/GameScreen';
import GameOverScreen from './src/screens/GameOverScreen';
import LanLobbyScreen from './src/screens/LanLobbyScreen';
import MultiplayerTableScreen from './src/screens/MultiplayerTableScreen';

const Stack = createNativeStackNavigator();
export default function App() { return <GestureHandlerRootView style={{ flex: 1 }}><NavigationContainer><Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false, animation: 'fade' }}><Stack.Screen name="Home" component={HomeScreen} /><Stack.Screen name="HowToPlay" component={HowToPlayScreen} /><Stack.Screen name="Settings" component={SettingsScreen} /><Stack.Screen name="Statistics" component={StatisticsScreen} /><Stack.Screen name="Game" component={GameScreen} /><Stack.Screen name="GameOver" component={GameOverScreen} /><Stack.Screen name="LanLobby" component={LanLobbyScreen} /><Stack.Screen name="MultiplayerTable" component={MultiplayerTableScreen} /></Stack.Navigator></NavigationContainer></GestureHandlerRootView>; }