import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { get14DayForecast } from "../../services/weather";

const BACKEND_URL = "http://192.168.1.8:8000";

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [annotatedB64, setAnnotatedB64] = useState<string | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [weather, setWeather] = useState<any>(null);
  const [showWeather, setShowWeather] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);

  /* ---------------------------------------
     Permissions + Weather + Location
  --------------------------------------- */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      // Reverse geocode → readable location
      const places = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (places.length > 0) {
        const p = places[0];
        const readable = [p.city || p.district, p.region]
          .filter(Boolean)
          .join(", ");
        setLocationName(readable);
      }

      const data = await get14DayForecast(latitude, longitude);
      setWeather(data);
    })();
  }, []);

  /* ---------------------------------------
     Pick Image / Camera
  --------------------------------------- */
  const resetState = () => {
    setAnnotatedB64(null);
    setDetections([]);
    setShowWeather(false);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!res.canceled && res.assets?.length) {
      resetState();
      setImageUri(res.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!res.canceled && res.assets?.length) {
      resetState();
      setImageUri(res.assets[0].uri);
    }
  };

  /* ---------------------------------------
     Upload & Predict
  --------------------------------------- */
  const uploadAndPredict = async () => {
    if (!imageUri) {
      Alert.alert("Photo required", "Please take or select a crop photo.");
      return;
    }

    setUploading(true);

    try {
      const name = imageUri.split("/").pop() || "photo.jpg";
      const ext = name.split(".").pop()?.toLowerCase();
      const mime = ext === "png" ? "image/png" : "image/jpeg";

      const formData = new FormData();
      formData.append("file", {
        uri: imageUri,
        name,
        type: mime,
      } as any);

      const r = await fetch(`${BACKEND_URL}/predict?score_thresh=0.25`, {
        method: "POST",
        body: formData,
      });

      if (!r.ok) throw new Error(await r.text());

      const j = await r.json();

      setAnnotatedB64(j.annotated_image_base64 || null);
      setDetections(j.detections || []);
      setShowWeather(true);
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setUploading(false);
    }
  };

  /* ---------------------------------------
     Unique detections (highest confidence)
  --------------------------------------- */
  const uniqueDetections = useMemo(() => {
    const map: Record<string, any> = {};
    detections.forEach((d) => {
      if (!map[d.label] || d.score > map[d.label].score) {
        map[d.label] = d;
      }
    });
    return Object.values(map);
  }, [detections]);

  /* ---------------------------------------
     UI
  --------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🌾 Agritech Crop Doctor</Text>
      <Text style={styles.subtitle}>AI-powered crop health check</Text>

      {/* ACTION BUTTONS */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto}>
          <Text style={styles.btnText}>📷 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={pickImage}>
          <Text style={styles.btnText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* IMAGE PREVIEW */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={{ color: "#777" }}>No crop image selected</Text>
        </View>
      )}

      {/* ANALYZE */}
      <TouchableOpacity
        style={[styles.analyzeBtn, uploading && { opacity: 0.6 }]}
        onPress={uploadAndPredict}
        disabled={uploading}
      >
        <Text style={styles.analyzeText}>
          {uploading ? "🔍 Analyzing..." : "🌱 Check Crop Health"}
        </Text>
      </TouchableOpacity>

      {uploading && <ActivityIndicator size="large" style={{ marginTop: 12 }} />}

      {/* AI DIAGNOSIS */}
      {uniqueDetections.length > 0 && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>🧠 AI Diagnosis</Text>
          {uniqueDetections.map((d, i) => (
            <View key={i} style={{ marginTop: 6 }}>
              <Text style={styles.issueText}>⚠️ {d.label}</Text>
              <Text style={styles.confText}>
                Confidence: {(d.score * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ANNOTATED IMAGE */}
      {annotatedB64 && (
        <Image
          source={{ uri: `data:image/png;base64,${annotatedB64}` }}
          style={styles.preview}
        />
      )}

      {/* WEATHER */}
      {showWeather && weather?.forecast?.forecastday && (
        <>
          {locationName && (
            <Text style={styles.locationText}>📍 Location: {locationName}</Text>
          )}

          <Text style={styles.sectionTitle}>
            🌦️ Weather Forecast ({weather.forecast.forecastday.length} days)
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {weather.forecast.forecastday.map((day: any, i: number) => (
              <View key={i} style={styles.weatherCard}>
                <Text style={styles.weatherDate}>{day.date}</Text>
                <Text>
                  🌡 {day.day.maxtemp_c}° / {day.day.mintemp_c}°
                </Text>
                <Text>🌧 {day.day.daily_chance_of_rain}% rain</Text>
                <Text style={styles.weatherCond}>
                  {day.day.condition.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* ADVICE */}
      {showWeather && (
        <View style={styles.adviceBox}>
          <Text style={styles.adviceTitle}>🧑‍🌾 Recommended Action</Text>
          <Text>• Avoid spraying before rain</Text>
          <Text>• Monitor crop for next 2–3 days</Text>
          <Text>• Early action prevents yield loss</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ---------------------------------------
   Styles
--------------------------------------- */
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "#555",
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  btnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },
  preview: {
    width: "100%",
    height: 260,
    borderRadius: 14,
    marginTop: 14,
    backgroundColor: "#eee",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  analyzeBtn: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 14,
  },
  analyzeText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  resultCard: {
    marginTop: 20,
    backgroundColor: "#fef3c7",
    padding: 14,
    borderRadius: 12,
  },
  resultTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  issueText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400e",
  },
  confText: {
    color: "#78350f",
  },
  sectionTitle: {
    marginTop: 22,
    fontSize: 18,
    fontWeight: "700",
  },
  locationText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#065f46",
  },
  weatherCard: {
    marginTop: 12,
    marginRight: 10,
    padding: 12,
    width: 150,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  weatherDate: {
    fontWeight: "700",
  },
  weatherCond: {
    marginTop: 4,
    fontSize: 12,
  },
  adviceBox: {
    marginTop: 20,
    backgroundColor: "#ecfeff",
    padding: 14,
    borderRadius: 12,
  },
  adviceTitle: {
    fontWeight: "700",
    marginBottom: 6,
  },
});