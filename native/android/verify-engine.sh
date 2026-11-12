#!/usr/bin/env bash
# Compiles the Android measurement engine on a desktop JVM and runs its checks.
#
# This is NOT an APK build. It verifies that every Kotlin source file compiles
# against the Android SDK's android.jar and that the schema/statistics/guidance
# logic behaves as specified.
#
# Requirements:
#   KOTLINC      path to the kotlinc launcher (Kotlin 2.x)
#   ANDROID_JAR  path to $ANDROID_HOME/platforms/android-35/android.jar
#   JAVA_HOME    JDK or JRE 17+
#
# Example:
#   KOTLINC=/opt/kotlinc/bin/kotlinc \
#   ANDROID_JAR=$ANDROID_HOME/platforms/android-35/android.jar \
#   ./verify-engine.sh

set -euo pipefail

: "${KOTLINC:?Set KOTLINC to the kotlinc launcher}"
: "${ANDROID_JAR:?Set ANDROID_JAR to \$ANDROID_HOME/platforms/android-35/android.jar}"

if [ ! -f "$ANDROID_JAR" ]; then
  echo "error: android.jar not found at $ANDROID_JAR" >&2
  exit 1
fi

KOTLIN_HOME="$(cd "$(dirname "$KOTLINC")/.." && pwd)"
KOTLIN_STDLIB="$KOTLIN_HOME/lib/kotlin-stdlib.jar"
if [ ! -f "$KOTLIN_STDLIB" ]; then
  echo "error: kotlin-stdlib.jar not found at $KOTLIN_STDLIB" >&2
  exit 1
fi

OUT="${OUT:-/tmp/phonecare-native-check}"
rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/verify"

mapfile -t SOURCES < <(find app/src/main/java -name '*.kt' | sort)
echo "Compiling ${#SOURCES[@]} Kotlin files against $(basename "$(dirname "$ANDROID_JAR")")…"
"$KOTLINC" -classpath "$ANDROID_JAR" -jvm-target 17 -d "$OUT/classes" "${SOURCES[@]}"

echo "Compiling verification harness…"
"$KOTLINC" -classpath "$OUT/classes:$ANDROID_JAR" -jvm-target 17 -d "$OUT/verify" verification/EngineChecks.kt

echo "Running engine checks…"
java -cp "$OUT/verify:$OUT/classes:$KOTLIN_STDLIB:$ANDROID_JAR" EngineChecksKt

echo
echo "OK: all sources compile; engine checks passed."
echo "This does not build an APK. Use build-local.sh with the Android SDK installed."
