import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../src/store/StoreContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'My Athletes' }} />
          <Stack.Screen name="athletes/index" options={{ title: 'Athletes' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Clip Settings' }} />
          <Stack.Screen name="games/new" options={{ title: 'New Game', presentation: 'modal' }} />
          <Stack.Screen name="games/[id]/index" options={{ title: 'Game' }} />
          <Stack.Screen
            name="games/[id]/record"
            options={{ headerShown: false, orientation: 'portrait' }}
          />
          <Stack.Screen name="games/[id]/player" options={{ title: 'Playback' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
