Replace placeholder model files with real TFLite binaries:

- `blazeface.tflite` (~0.5MB)
- `face_mesh.tflite` (~3MB)
- `mobilefacenet_int8.tflite` (~4MB)

Expected pipeline inputs:

- BlazeFace: RGB `128x128`
- Face Mesh: cropped face `192x192`
- MobileFaceNet: aligned `112x112`, normalized to `[-1, 1]`
