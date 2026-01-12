import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, Button, Image, Alert, ActivityIndicator, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import * as FileSystem from "expo-file-system";

const BACKEND_URL = "http://192.168.1.5:8000"; // <<-- set this to your Mac's LAN IP and port

//const BACKEND_URL = "http://192.168.1.1:8000"; // <<-- set this to your Mac's LAN IP and port
export default function App() {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(null);
  const [photo, setPhoto] = useState(null); // local uri
  const [uploading, setUploading] = useState(false);
  const [annotatedBase64, setAnnotatedBase64] = useState(null);
  const [detections, setDetections] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cam.status === "granted");
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasMediaLibraryPermission(lib.status === "granted");
    })();
  }, []);

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!res.cancelled) {
        setPhoto(res.uri);
        setAnnotatedBase64(null);
        setDetections([]);
      }
    } catch (err) {
      Alert.alert("Error", String(err));
    }
  };

  const openCamera = async () => {
    // Use the camera UI (expo-image-picker also offers launchCameraAsync)
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!res.cancelled) {
        setPhoto(res.uri);
        setAnnotatedBase64(null);
        setDetections([]);
      }
    } catch (err) {
      Alert.alert("Camera error", String(err));
    }
  };

  const uploadAndPredict = async () => {
    if (!photo) {
      Alert.alert("No image", "Please pick or take a photo first.");
      return;
    }
    setUploading(true);
    setAnnotatedBase64(null);
    setDetections([]);

    try {
      // Build multipart form data
      const fileInfo = await FileSystem.getInfoAsync(photo);
      // derive name and type
      const name = photo.split("/").pop() || "photo.jpg";
      // Try to infer mime type
      const ext = name.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";

      const formData = new FormData();
      // fetch expects an object for files on RN: { uri, name, type }
      //formData.append("file", { uri: photo, name, type: mime });
      const fileUri = photo.startsWith("file://") ? photo : `file://${photo}`;

        formData.append("file", {
          uri: fileUri,
          name,
          type: mime,
        });

      // Optionally include score_thresh
      const url = `${BACKEND_URL}/predict?score_thresh=0.25`;

      console.log("Uploading to", url, "file:", name, "mime:", mime, "size:", fileInfo.size);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          // Note: DO NOT set Content-Type manually; fetch sets it automatically with boundary.
          Accept: "application/json",
        },
      });

      console.log("HTTP status", response.status);

      if (!response.ok) {
        const txt = await response.text();
        console.warn("Server error text:", txt);
        throw new Error(`Server returned ${response.status}: ${txt}`);
      }

      const j = await response.json();
      console.log("Server response JSON:", j);

      // j should have keys: detections (array), annotated_image_base64
      if (j.annotated_image_base64) {
        setAnnotatedBase64(j.annotated_image_base64);
      } else {
        setAnnotatedBase64(null);
      }

      if (Array.isArray(j.detections)) {
        setDetections(j.detections);
      } else {
        setDetections([]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      Alert.alert("Upload error", String(err));
    } finally {
      setUploading(false);
    }
  };

  // Helper to show base64 as data-uri
  const annotatedUri = annotatedBase64 ? `data:image/png;base64,${annotatedBase64}` : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agritech Mobile — Inference</Text>

      <View style={styles.buttonsRow}>
        <Button title="Pick Image" onPress={pickImage} />
        <View style={{ width: 12 }} />
        <Button title="Camera" onPress={openCamera} />
      </View>

      <View style={{ height: 16 }} />

      <View style={styles.previewArea}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text>No image selected</Text>
          </View>
        )}
      </View>

      <View style={{ height: 12 }} />
      <Button title={uploading ? "Uploading..." : "Upload & Predict"} onPress={uploadAndPredict} disabled={uploading} />

      {uploading && (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6 }}>Uploading and waiting for predictions...</Text>
        </View>
      )}

      <ScrollView style={{ width: "100%", marginTop: 18 }}>
        {annotatedUri ? (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: "bold" }}>Annotated result</Text>
            <Image source={{ uri: annotatedUri }} style={styles.annotated} resizeMode="contain" />
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "bold" }}>Detections ({detections.length})</Text>
          {detections.length === 0 ? (
            <Text style={{ marginTop: 6 }}>No detections returned yet.</Text>
          ) : (
            detections.map((d, i) => (
              <View key={i} style={styles.detRow}>
                <Text style={{ fontWeight: "600" }}>{d.label ?? `class ${d.class_id}`}</Text>
                <Text>score: {Number(d.score).toFixed(3)}</Text>
                <Text>
                  xy: [{Math.round(d.x1)},{Math.round(d.y1)}] → [{Math.round(d.x2)},{Math.round(d.y2)}]
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  buttonsRow: { flexDirection: "row" },
  previewArea: { width: "90%", height: 260, backgroundColor: "#eee", borderRadius: 8, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  annotated: { marginTop: 8, width: 320, height: 240, borderRadius: 8 },
  detRow: { marginTop: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: "#ddd" },
});