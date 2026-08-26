import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from '~/screens/splash';
import LoginScreen from '~/screens/login';
import LobbyScreen from '~/screens/lobby';
import TableScreen from '~/screens/table';
import ResultsScreen from '~/screens/results';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Table" component={TableScreen} />
          <Stack.Screen name="Results" component={ResultsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
