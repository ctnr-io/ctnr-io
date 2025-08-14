// If using Expo Router, import your CSS file in the app/_layout.tsx file
import 'app/global.css';
import { Stack } from 'expo-router';

export default function() {
	return <Stack screenOptions={{ headerShown: false }} />;
}