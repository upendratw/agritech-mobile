// app/(tabs)/index.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { get14DayForecast } from "../../services/weather";

const BACKEND_URL = "http://192.168.1.8:8000"; // ✅ correct IP

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [annotatedB64, setAnnotatedB64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [weather, setWeather] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

  /* --------------------------------------------------
     🌦️ GET WEATHER ON APP OPEN (KEY FIX)
  -------------------------------------------------- */
  useEffect(() => {
    const init = async () => {
      try {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();

        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          Alert.alert(
            "Location Required",
            "Location is needed to show weather forecast"
          );
          setLoadingWeather(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const data = await get14DayForecast(
          loc.coords.latitude,
          loc.coords.longitude
        );

        setWeather(data);
      } catch (e) {
        console.error("Weather error", e);
        Alert.alert("Weather error", "Unable to fetch weather");
      } finally {
        setLoadingWeather(false);
      }
    };

    init();
  }, []);

  /* --------------------------------------------------
     Image pick & camera
  -------------------------------------------------- */
const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
  });

  if (!result.canceled && result.assets?.[0]?.uri) {
    setImageUri(result.assets[0].uri);
    setAnnotatedB64(null);
  }
};

const takePhoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
  });

  if (!result.canceled && result.assets?.[0]?.uri) {
    setImageUri(result.assets[0].uri);
    setAnnotatedB64(null);
  }
};

  /* --------------------------------------------------
     Upload & Predict
  -------------------------------------------------- */
  const uploadAndPredict = async () => {
    if (!imageUri) {
      Alert.alert("Photo needed", "Please take or select a crop photo.");
      return;
    }

    setUploading(true);
    setAnnotatedB64(null);

    try {
      const filename = imageUri.split("/").pop() || "photo.jpg";
      const ext = filename.split(".").pop()?.toLowerCase();
      const mime = ext === "png" ? "image/png" : "image/jpeg";

      const formData = new FormData();
      formData.append("file", {
        uri: imageUri,
        name: filename,
        type: mime,
      } as any);

      const r = await fetch(`${BACKEND_URL}/predict?score_thresh=0.25`, {
        method: "POST",
        body: formData,
      });

      if (!r.ok) throw new Error(await r.text());

      const j = await r.json();
      setAnnotatedB64(j.annotated_image_base64 || null);
    } catch (err) {
      Alert.alert("Upload failed", String(err));
    } finally {
      setUploading(false);
    }
  };

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🌾 Agritech Crop Doctor</Text>

      {/* IMAGE ACTIONS */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.bigButton} onPress={takePhoto}>
          <Text style={styles.bigButtonText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigButton} onPress={pickImage}>
          <Text style={styles.bigButtonText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* IMAGE PREVIEW */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={{ color: "#777" }}>No crop photo selected</Text>
        </View>
      )}

      {/* ANALYZE */}
      <TouchableOpacity
        style={[
          styles.analyzeButton,
          (!imageUri || uploading) && { opacity: 0.5 },
        ]}
        onPress={uploadAndPredict}
        disabled={!imageUri || uploading}
      >
        <Text style={styles.analyzeText}>
          {uploading ? "🔍 Analyzing..." : "🌱 Check Crop Health"}
        </Text>
      </TouchableOpacity>

      {uploading && <ActivityIndicator size="large" />}

      {/* DETECTION RESULT */}
      {annotatedB64 && (
        <>
          <Text style={styles.sectionTitle}>🧪 Detection Result</Text>
          <Image
            source={{ uri: `data:image/png;base64,${annotatedB64}` }}
            style={styles.preview}
          />
        </>
      )}

      {/* 🌦️ WEATHER SECTION */}
      <Text style={styles.sectionTitle}>🌦 14-Day Weather Forecast</Text>

      {loadingWeather && <ActivityIndicator />}

      {weather?.forecast?.forecastday?.map((day: any, i: number) => (
        <View key={i} style={styles.weatherCard}>
          <Text style={{ fontWeight: "700" }}>{day.date}</Text>
          <Text>🌡️ Max: {day.day.maxtemp_c}°C</Text>
          <Text>❄️ Min: {day.day.mintemp_c}°C</Text>
          <Text>🌧 Rain Chance: {day.day.daily_chance_of_rain}%</Text>
          <Text>☀️ {day.day.condition.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/* --------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  bigButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  bigButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  preview: {
    width: "90%",
    height: 260,
    borderRadius: 10,
    backgroundColor: "#f2f2f2",
    marginTop: 10,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  analyzeButton: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  analyzeText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  weatherCard: {
    width: "100%",
    backgroundColor: "#f1f5f9",
    padding: 12,
    marginTop: 8,
    borderRadius: 8,
  },
});