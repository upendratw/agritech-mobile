import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Button,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { get14DayForecast } from "./services/weather";

const BACKEND_URL = "http://192.168.1.8:8000"; // your Mac LAN IP

export default function App() {
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [annotatedBase64, setAnnotatedBase64] = useState(null);
  const [detections, setDetections] = useState([]);

  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [showWeather, setShowWeather] = useState(false);

  /* ---------------------------------------------------
     🌦️ FETCH WEATHER ON APP OPEN (BACKGROUND)
  --------------------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        setLoadingWeather(true);

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const data = await get14DayForecast(
          loc.coords.latitude,
          loc.coords.longitude
        );

        setWeather(data);
      } catch (err) {
        console.log("Weather fetch failed:", err);
      } finally {
        setLoadingWeather(false);
      }
    })();
  }, []);

  /* ---------------------------------------------------
     Image Pick / Camera
  --------------------------------------------------- */
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!res.canceled && res.assets?.length) {
      setPhoto(res.assets[0].uri);
      resetResults();
    }
  };

  const openCamera = async () => {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!res.canceled && res.assets?.length) {
      setPhoto(res.assets[0].uri);
      resetResults();
    }
  };

  const resetResults = () => {
    setAnnotatedBase64(null);
    setDetections([]);
    setShowWeather(false);
  };

  /* ---------------------------------------------------
     Upload & Predict
  --------------------------------------------------- */
  const uploadAndPredict = async () => {
    if (!photo) {
      Alert.alert("No image", "Please pick or take a photo first.");
      return;
    }

    setUploading(true);

    try {
      const name = photo.split("/").pop() || "photo.jpg";
      const ext = name.split(".").pop()?.toLowerCase();
      const mime = ext === "png" ? "image/png" : "image/jpeg";

      const formData = new FormData();
      formData.append("file", {
        uri: photo,
        name,
        type: mime,
      });

      const response = await fetch(
        `${BACKEND_URL}/predict?score_thresh=0.25`,
        {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const j = await response.json();

      setAnnotatedBase64(j.annotated_image_base64 || null);
      setDetections(Array.isArray(j.detections) ? j.detections : []);

      // ✅ SHOW WEATHER ONLY AFTER DETECTION
      setShowWeather(true);
    } catch (err) {
      Alert.alert("Upload error", String(err));
    } finally {
      setUploading(false);
    }
  };

  const annotatedUri = annotatedBase64
    ? `data:image/png;base64,${annotatedBase64}`
    : null;

  /* ---------------------------------------------------
     UI
  --------------------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🌱 Agritech Mobile</Text>

      {/* Image Controls */}
      <View style={styles.buttonsRow}>
        <Button title="Pick Image" onPress={pickImage} />
        <View style={{ width: 12 }} />
        <Button title="Camera" onPress={openCamera} />
      </View>

      {/* Image Preview */}
      <View style={styles.previewArea}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.previewImage} />
        ) : (
          <Text>No image selected</Text>
        )}
      </View>

      <Button
        title={uploading ? "Predicting..." : "Upload & Predict"}
        onPress={uploadAndPredict}
        disabled={uploading}
      />

      {uploading && <ActivityIndicator style={{ marginTop: 10 }} />}

      {/* Detection Results */}
      {annotatedUri && (
        <>
          <Text style={styles.sectionTitle}>Detected Issues</Text>
          <Image source={{ uri: annotatedUri }} style={styles.annotated} />
        </>
      )}

      {detections.map((d, i) => (
        <Text key={i}>
          {d.label} — {(d.score * 100).toFixed(1)}%
        </Text>
      ))}

      {/* 🌦️ WEATHER SECTION (SHOWN ONLY AFTER DETECTION) */}
      {showWeather && (
        <>
          <Text style={styles.sectionTitle}>14-Day Weather Forecast</Text>

          {loadingWeather && <ActivityIndicator />}

          {weather?.forecast?.forecastday?.map((day, i) => (
            <View key={i} style={styles.weatherCard}>
              <Text style={{ fontWeight: "bold" }}>📅 {day.date}</Text>
              <Text>🌡️ Max: {day.day.maxtemp_c}°C</Text>
              <Text>❄️ Min: {day.day.mintemp_c}°C</Text>
              <Text>🌧️ Rain Chance: {day.day.daily_chance_of_rain}%</Text>
              <Text>☀️ {day.day.condition.text}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/* ---------------------------------------------------
   Styles
--------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "600",
  },
  buttonsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  previewArea: {
    width: "100%",
    height: 220,
    backgroundColor: "#eee",
    borderRadius: 8,
    marginVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  annotated: {
    width: 320,
    height: 240,
    marginVertical: 10,
  },
  weatherCard: {
    width: "100%",
    padding: 10,
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
});