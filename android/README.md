# Android App Integration & API Specification

This document provides complete instructions, API documentation, and ready-to-use Kotlin code for building the Android client app for the **Result Publishing & Display System**.

---

## 1. REST API Endpoints Overview

Base URL: `http://<your-server-ip-or-domain>:3000`

All endpoints return JSON and include standard CORS headers (`Access-Control-Allow-Origin: *`).

### 1.1 Server Status & Time
- **Method**: `GET`
- **Endpoint**: `/api/public/status`
- **Description**: Returns server date, time, operating hours status, and active slot.
- **Response**:
```json
{
  "success": true,
  "currentDate": "26-10-2026",
  "currentDateIso": "2026-10-26",
  "currentTime": "11:00",
  "activeSlot": "11:00",
  "isOperatingHours": true,
  "isOpen": true,
  "settings": {
    "prefixes": ["R$R", "C$H", "N$V", "R$Y"],
    "groupTitle": "YANTRA GROUP",
    "eventTitle": "Gift Event Code",
    "version": "Version-1.0"
  }
}
```

---

### 1.2 Fetch Captcha
- **Method**: `GET`
- **Endpoint**: `/api/public/captcha`
- **Description**: Generates a 5-character captcha and an HMAC-signed token.
- **Response**:
```json
{
  "success": true,
  "captchaText": "gHZox",
  "captchaToken": "Z0haT3g6MTc5Mjk5...=="
}
```

---

### 1.3 Verify Captcha
- **Method**: `POST`
- **Endpoint**: `/api/public/verify-captcha`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "captchaToken": "Z0haT3g6MTc5Mjk5...==",
  "userInput": "gHZox"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Captcha verified successfully"
}
```

---

### 1.4 Get Live Results (4 Cards)
- **Method**: `GET`
- **Endpoint**: `/api/public/live`
- **Description**: Fetches the 4 cards for the current 15-minute slot.
  - If current time is outside 08:30 AM – 11:00 PM, `isOpen` is `false`.
- **Response**:
```json
{
  "success": true,
  "isOpen": true,
  "date": "26-10-2026",
  "slot": "11:00",
  "cards": [
    { "prefix": "R$R", "num": "15", "code": "R$R15" },
    { "prefix": "C$H", "num": "48", "code": "C$H48" },
    { "prefix": "N$V", "num": "92", "code": "N$V92" },
    { "prefix": "R$Y", "num": "30", "code": "R$Y30" }
  ],
  "isDeclared": true
}
```

---

### 1.5 Get All Results (59 Slots Table)
- **Method**: `GET`
- **Endpoint**: `/api/public/results?date=YYYY-MM-DD`
- **Description**: Returns all 59 slots for the day in reverse-chronological order (23:00 down to 08:30).
- **Response**:
```json
{
  "success": true,
  "date": "26-10-2026",
  "dateIso": "2026-10-26",
  "prefixes": ["R$R", "C$H", "N$V", "R$Y"],
  "groupTitle": "YANTRA GROUP",
  "eventTitle": "Gift Event Code",
  "slots": [
    {
      "slotTime": "11:00",
      "isPublished": true,
      "c1": "R$R15",
      "c2": "C$H48",
      "c3": "N$V92",
      "c4": "R$Y30"
    },
    {
      "slotTime": "10:45",
      "isPublished": true,
      "c1": "R$R61",
      "c2": "C$H32",
      "c3": "N$V30",
      "c4": "R$Y63"
    }
  ]
}
```

---

### 1.6 Real-Time Live Stream (SSE)
- **Method**: `GET`
- **Endpoint**: `/api/public/stream`
- **Protocol**: Server-Sent Events (`text/event-stream`)
- **Event**: `result_updated`
- **Payload**:
```json
{
  "date": "2026-10-26",
  "slotTime": "11:00",
  "r1": "15",
  "r2": "48",
  "r3": "92",
  "r4": "30",
  "prefixes": ["SR", "MK", "GL", "VN"]
}
```

---

## 2. Native Android Implementation (Kotlin)

### 2.1 Dependencies (`build.gradle.kts`)
```kotlin
dependencies {
    // Retrofit & Moshi / Gson
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.0")
}
```

### 2.2 Retrofit Interface (`ResultApiService.kt`)
```kotlin
package com.result.app.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface ResultApiService {

    @GET("/api/public/status")
    suspend fun getStatus(): Response<StatusResponse>

    @GET("/api/public/captcha")
    suspend fun getCaptcha(): Response<CaptchaResponse>

    @POST("/api/public/verify-captcha")
    suspend fun verifyCaptcha(@Body request: VerifyCaptchaRequest): Response<BaseResponse>

    @GET("/api/public/live")
    suspend fun getLiveResults(): Response<LiveResultsResponse>

    @GET("/api/public/results")
    suspend fun getAllResults(@Query("date") date: String? = null): Response<AllResultsResponse>
}

// Data Models
data class BaseResponse(val success: Boolean, val message: String?)
data class CaptchaResponse(val success: Boolean, val captchaText: String, val captchaToken: String)
data class VerifyCaptchaRequest(val captchaToken: String, val userInput: String)

data class LiveResultsResponse(
    val success: Boolean,
    val isOpen: Boolean,
    val date: String?,
    val slot: String?,
    val cards: List<CardResult>?,
    val isDeclared: Boolean
)

data class CardResult(val prefix: String, val num: String, val code: String)

data class AllResultsResponse(
    val success: Boolean,
    val date: String,
    val prefixes: List<String>,
    val groupTitle: String,
    val eventTitle: String,
    val slots: List<SlotResultItem>
)

data class SlotResultItem(
    val slotTime: String,
    val isPublished: Boolean,
    val c1: String,
    val c2: String,
    val c3: String,
    val c4: String
)
```

---

## 3. WebView / Hybrid Android App Implementation (Locked to Landscape Mode)

### 3.1 AndroidManifest.xml (Forces Landscape Mode)
Add `android:screenOrientation="sensorLandscape"` to lock the app into horizontal landscape mode:
```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:screenOrientation="sensorLandscape"
    android:configChanges="orientation|keyboardHidden|screenSize">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>
```

### 3.2 MainActivity.kt
```kotlin
package com.result.app

import android.annotation.SuppressLint
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Force Landscape Orientation by default
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

        // Immersive Fullscreen (Hide system bars for arcade/game feel)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = WebViewClient()

        // Point to your VPS server URL
        webView.loadUrl("http://<your-server-ip>:3000/")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```
