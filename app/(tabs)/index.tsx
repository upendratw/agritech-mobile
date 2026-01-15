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
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { get14DayForecast } from "../../services/weather";

const BACKEND_URL = "http://192.168.1.8:8000";

const CROPS = ["Select Crop", "Jowar", "Toor dal", "Urad dal", "Cotton"];

export default function HomeScreen() {
  const [selectedCrop, setSelectedCrop] = useState("Select Crop");
  const [showCropModal, setShowCropModal] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [annotatedB64, setAnnotatedB64] = useState<string | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [adviceMap, setAdviceMap] = useState<Record<string, string>>({});
  const [weather, setWeather] = useState<any>(null);
  const [showWeather, setShowWeather] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);

  /* ---------------------------------------
     Location + Weather (on app open)
  --------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const places = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (places.length > 0) {
          const p = places[0];
          setLocationName(
            [p.city || p.district, p.region].filter(Boolean).join(", ")
          );
        }

        const data = await get14DayForecast(latitude, longitude);
        setWeather(data);
      } catch (err) {
        console.log("Weather/location error:", err);
      }
    })();
  }, []);

  const resetState = () => {
    setAnnotatedB64(null);
    setDetections([]);
    setAdviceMap({});
    setShowWeather(false);
  };

  /* ---------------------------------------
     Image actions
  --------------------------------------- */
  const requireCrop = () => {
    if (selectedCrop === "Select Crop") {
      Alert.alert("Select Crop", "Please select crop first");
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    if (!requireCrop()) return;

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
    if (!requireCrop()) return;

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
    if (!imageUri) return;

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

      await fetchTreatmentAdvice(j.detections || []);
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setUploading(false);
    }
  };

  /* ---------------------------------------
     Unique detections
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

  const fetchTreatmentAdvice = async (dets: any[]) => {
    const out: Record<string, string> = {};
    for (const d of dets) {
      try {
        const r = await fetch(
          `${BACKEND_URL}/treatment-advice?crop=${selectedCrop}&label=${d.label}`
        );
        const j = await r.json();
        out[d.label] = j.advice;
      } catch {}
    }
    setAdviceMap(out);
  };

  /* ---------------------------------------
     UI
  --------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🌾 Agritech Crop Doctor</Text>

      {/* CROP DROPDOWN */}
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setShowCropModal(true)}
      >
        <Text style={styles.dropdownText}>{selectedCrop}</Text>
      </TouchableOpacity>

      {/* DROPDOWN MODAL */}
      <Modal transparent visible={showCropModal} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowCropModal(false)}
        >
          <View style={styles.modalBox}>
            {CROPS.map((c) => (
              <TouchableOpacity
                key={c}
                style={styles.modalItem}
                onPress={() => {
                  setSelectedCrop(c);
                  setShowCropModal(false);
                }}
              >
                <Text style={styles.modalText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ACTIONS */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto}>
          <Text style={styles.btnText}>📷 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={pickImage}>
          <Text style={styles.btnText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* IMAGE */}
      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

      <TouchableOpacity style={styles.analyzeBtn} onPress={uploadAndPredict}>
        <Text style={styles.analyzeText}>
          {uploading ? "Analyzing..." : "🌱 Check Crop Health"}
        </Text>
      </TouchableOpacity>

      {uploading && <ActivityIndicator style={{ marginTop: 12 }} />}

      {/* RESULTS */}
      {uniqueDetections.map((d, i) => (
        <View key={i} style={styles.resultCard}>
          <Text style={styles.issueText}>⚠️ {d.label}</Text>
          <Text>Confidence: {(d.score * 100).toFixed(0)}%</Text>

          {adviceMap[d.label] && (
            <View style={styles.adviceBox}>
              <Text style={styles.adviceTitle}>🧑‍🌾 Treatment Advice</Text>
              <Text>{adviceMap[d.label]}</Text>
            </View>
          )}
        </View>
      ))}

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
          <Text style={styles.weatherTitle}>
            🌦️ Weather Forecast ({weather.forecast.forecastday.length} days)
          </Text>

          {locationName && (
            <Text style={styles.locationText}>📍 {locationName}</Text>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {weather.forecast.forecastday.map((d: any, i: number) => (
              <View key={i} style={styles.weatherCard}>
                <Text style={styles.weatherDate}>{d.date}</Text>
                <Text>🌡 {d.day.maxtemp_c}° / {d.day.mintemp_c}°</Text>
                <Text>🌧 {d.day.daily_chance_of_rain}% rain</Text>
                <Text style={styles.weatherCond}>
                  {d.day.condition.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

/* ---------------------------------------
   Styles
--------------------------------------- */
const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },

  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },

  dropdown: {
    borderWidth: 1,
    borderColor: "#16a34a",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  dropdownText: { fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    width: "80%",
    borderRadius: 12,
    padding: 8,
  },
  modalItem: { padding: 12 },
  modalText: { fontWeight: "600" },

  actionRow: { flexDirection: "row", marginBottom: 8 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "700" },

  preview: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: "#eee",
  },

  analyzeBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  analyzeText: { color: "#fff", textAlign: "center", fontWeight: "700" },

  resultCard: {
    marginTop: 16,
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 12,
  },
  issueText: { fontSize: 18, fontWeight: "700", color: "#92400e" },

  adviceBox: {
    marginTop: 8,
    backgroundColor: "#ecfeff",
    padding: 10,
    borderRadius: 8,
  },
  adviceTitle: { fontWeight: "700", marginBottom: 4 },

  weatherTitle: { marginTop: 20, fontSize: 20, fontWeight: "800" },
  locationText: { marginBottom: 6, fontWeight: "600", color: "#065f46" },
  weatherCard: {
    padding: 10,
    backgroundColor: "#f1f5f9",
    margin: 6,
    borderRadius: 8,
    width: 160,
  },
  weatherDate: { fontWeight: "700" },
  weatherCond: { fontSize: 12, marginTop: 4 },
});