// app/(tabs)/index.tsx
// replace your current screen with this component
import React, { useState, useEffect } from "react";
import { View, Text, Button, Image, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library"; // optional; can remove if not used
import { useRouter } from "expo-router";

const BACKEND_URL = "http://192.168.1.5:8000"; // <-- your machine IP:8000

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);         // local image preview (picked / camera)
  const [annotatedB64, setAnnotatedB64] = useState(null); // annotated image from backend (base64)
  const [uploading, setUploading] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  useEffect(() => {
    (async () => {
      // request media library & camera permissions for iOS/Android
      try {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        // note: in Expo Go on Android, full media library access might be limited — OK for dev
        setPermissionChecked(true);
        if (cameraStatus !== "granted" && mediaStatus !== "granted") {
          // not blocking: user can still pick from gallery if that permission is available
          console.warn("Camera or media permissions not granted. Some features may be limited.");
        }
      } catch (e) {
        console.warn("Permission check error", e);
        setPermissionChecked(true);
      }
    })();
  }, []);

  // modern pick from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // still supported but shows deprecation warning; you can use ImagePicker.MediaType.Images
        quality: 0.9,
        allowsEditing: false,
      });

      // new API: result.canceled (boolean) and result.assets (array)
      if (!result || result.canceled) {
        // canceled or nothing selected
        return;
      }

      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      if (asset && asset.uri) {
        setImageUri(asset.uri);
        setAnnotatedB64(null);
      } else if (result.uri) {
        // fallback for older versions
        setImageUri(result.uri);
        setAnnotatedB64(null);
      }
    } catch (err) {
      Alert.alert("Pick error", String(err));
    }
  };

  // modern camera capture
  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result || result.canceled) return;

      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      if (asset && asset.uri) {
        setImageUri(asset.uri);
        setAnnotatedB64(null);

        // optional: save to gallery (Expo Go warns on Android). Uncomment if you want and have permission:
        // try { await MediaLibrary.createAssetAsync(asset.uri); } catch(e){ console.warn("save failed", e); }
      } else if (result.uri) {
        setImageUri(result.uri);
        setAnnotatedB64(null);
      }
    } catch (err) {
      Alert.alert("Camera error", String(err));
    }
  };

  // Upload & predict
  const uploadAndPredict = async () => {
    if (!imageUri) {
      Alert.alert("No image", "Please pick or capture an image first.");
      return;
    }

    setUploading(true);
    setAnnotatedB64(null);

    try {
      const formData = new FormData();
      const filename = imageUri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const ext = match ? match[1] : "jpg";
      const mime = ext.toLowerCase() === "png" ? "image/png" : "image/jpeg";

      // fetch file blob in RN:
      const resp = await fetch(imageUri);
      const blob = await resp.blob();

      // Append file (RN FormData needs name/type)
      formData.append("file", {
        uri: imageUri,
        name: filename || `photo.${ext}`,
        type: mime,
      });

      // If your backend expects query param score_thresh, you can add it to URL, e.g. ?score_thresh=0.25
      const url = `${BACKEND_URL}/predict`;

      const r = await fetch(url, {
        method: "POST",
        body: formData,
        // DO NOT set Content-Type header; let fetch set the multipart boundary
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`HTTP ${r.status}: ${text}`);
      }

      const j = await r.json();
      // expected shape: { detections: [...], annotated_image_base64: "...", model_path: "..." }
      if (j.annotated_image_base64) {
        setAnnotatedB64(j.annotated_image_base64);
      } else if (j.detections && j.detections.length) {
        Alert.alert("Detections", `Found ${j.detections.length} detections`);
      } else {
        Alert.alert("No detections", "Model found no objects.");
      }
    } catch (err) {
      console.error("Upload error", err);
      Alert.alert("Upload failed", String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agritech Detector</Text>

      <View style={styles.buttonRow}>
        <Button title="Pick from Gallery" onPress={pickImage} />
        <View style={{ width: 12 }} />
        <Button title="Take Photo" onPress={takePhoto} />
      </View>

      <View style={{ height: 12 }} />

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
      ) : (
        <View style={[styles.preview, styles.previewPlaceholder]}>
          <Text style={{ color: "#666" }}>No image selected</Text>
        </View>
      )}

      <View style={{ height: 12 }} />

      <Button
        title={uploading ? "Uploading..." : "Upload & Predict"}
        onPress={uploadAndPredict}
        disabled={!imageUri || uploading}
      />

      <View style={{ height: 12 }} />

      {uploading && <ActivityIndicator size="large" />}

      {annotatedB64 ? (
        <>
          <Text style={{ marginTop: 12 }}>Annotated result:</Text>
          <Image
            source={{ uri: `data:image/png;base64,${annotatedB64}` }}
            style={[styles.preview, { marginTop: 8 }]}
            resizeMode="contain"
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  buttonRow: { flexDirection: "row", justifyContent: "center" },
  preview: { width: "90%", height: 300, borderRadius: 8, backgroundColor: "#f2f2f2" },
  previewPlaceholder: { alignItems: "center", justifyContent: "center" },
});