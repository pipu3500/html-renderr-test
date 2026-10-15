// Oberste Ebene: legt nur fest, welche Plugin-Versionen zur Verfügung stehen.
// Die eigentliche App-Konfiguration steht in app/build.gradle.kts.
plugins {
    // Bewusst die 8er-Reihe (nicht 9.x): ab AGP 9 ist eine "eingebaute" Kotlin-Unterstützung
    // standardmäßig aktiv, die mit dem separat eingebundenen Kotlin-Plugin kollidiert (und das
    // Abschalten dieser eingebauten Unterstützung war zum Zeitpunkt dieses Projekts seinerseits
    // fehlerhaft). AGP 8.13 unterstützt compileSdk 36 bereits vollständig und ist stabil.
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
}
