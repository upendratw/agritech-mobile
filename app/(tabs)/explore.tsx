// app/(tabs)/explore.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function ExploreScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🌾 Agritech Assistant</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌦 Weather Advisory</Text>
        <Text style={styles.cardText}>
          Weather plays a major role in pest attacks and crop diseases.
          This app shows upcoming weather to help farmers plan spraying,
          irrigation, and harvesting.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧪 Crop Health Detection</Text>
        <Text style={styles.cardText}>
          Take a photo of your crop leaf using the Home screen.
          The AI model detects pests and diseases early.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚜 Coming Soon</Text>
        <Text style={styles.cardText}>
          • Treatment recommendations{"\n"}
          • Fertilizer guidance{"\n"}
          • Voice support in Telugu{"\n"}
          • Offline mode for villages
        </Text>
      </View>

      <Text style={styles.footer}>
        Built for farmers. Powered by AI 🌱
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#f1f5f9",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },
});