// Picks a profile photo (camera or library), squares and shrinks it on the
// phone, and hands back a small JPEG. The store decides what to do with it:
// the demo keeps the local file, the live app uploads it (lib/photos.ts).
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Platform, View } from "react-native";
import { Avatar, Btn, Row, T, useToast } from "@/components/ui";
import { PHOTO_QUALITY, PHOTO_SIZE, type PickedPhoto } from "@/lib/photos";

export function PhotoPicker({ name, uri, onPicked }: {
  name: string;
  uri: string | null;
  /** Resolves true when the photo is saved (or removed, when given null). */
  onPicked: (photo: PickedPhoto | null) => Promise<boolean>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async (from: "camera" | "library") => {
    setBusy(true);
    try {
      const perm = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast(from === "camera" ? "Intro needs the camera for that. You can allow it in your phone's settings." : "Intro needs access to your photos for that. You can allow it in your phone's settings.");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const result = from === "camera"
        ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      await onPicked(await shrink(result.assets[0].uri));
    } catch {
      toast("Couldn't use that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try { await onPicked(null); } finally { setBusy(false); }
  };

  return (
    <Row gap={12} style={{ alignItems: "center" }}>
      <Avatar name={name} uri={uri} hue={210} size={72} />
      <View style={{ flex: 1, gap: 6 }}>
        <T variant="small">{uri
          ? "Shown with your first name once someone agrees to be put forward."
          : "Add a photo of your face. It's shown with your first name once someone agrees to be put forward, and checked against your ID selfie."}</T>
        <Row wrap gap={6}>
          {Platform.OS !== "web" && <Btn small variant="ghost" label="Take a photo" disabled={busy} onPress={() => pick("camera")} />}
          <Btn small variant="ghost" label={uri ? "Change photo" : "Choose a photo"} disabled={busy} onPress={() => pick("library")} />
          {uri ? <Btn small variant="ghost" label="Remove" disabled={busy} onPress={remove} /> : null}
        </Row>
      </View>
    </Row>
  );
}

/** Resize to PHOTO_SIZE on the longest side and save as a JPEG with its base64. */
async function shrink(uri: string): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: PHOTO_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
  if (!saved.base64) throw new Error("No image data");
  return { uri: saved.uri, base64: saved.base64 };
}
