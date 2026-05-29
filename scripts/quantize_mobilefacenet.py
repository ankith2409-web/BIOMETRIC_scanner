import tensorflow as tf

SOURCE_SAVED_MODEL = "models/mobilefacenet_saved_model"
OUTPUT_TFLITE = "assets/models/mobilefacenet_int8.tflite"


def representative_dataset():
    for _ in range(100):
        sample = tf.random.uniform([1, 112, 112, 3], minval=-1.0, maxval=1.0, dtype=tf.float32)
        yield [sample]


def main():
    converter = tf.lite.TFLiteConverter.from_saved_model(SOURCE_SAVED_MODEL)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    converter.representative_dataset = representative_dataset
    tflite_model = converter.convert()
    with open(OUTPUT_TFLITE, "wb") as f:
        f.write(tflite_model)
    print(f"Wrote {OUTPUT_TFLITE}")


if __name__ == "__main__":
    main()
