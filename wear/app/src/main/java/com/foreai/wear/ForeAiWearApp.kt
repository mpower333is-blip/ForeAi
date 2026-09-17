package com.foreai.wear

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

// Initialises Firebase from the same explicit config the phone app and clubhouse
// website use (project foreai-f9cfa). Doing it in code means the watch needs NO
// google-services.json / google-services Gradle plugin, so it builds in CI
// without an extra secret file — Firestore + anonymous Auth then work exactly as
// they do on the phone. (These are public client config values, safe to ship.)
class ForeAiWearApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (FirebaseApp.getApps(this).isEmpty()) {
            val options = FirebaseOptions.Builder()
                .setProjectId("foreai-f9cfa")
                .setApplicationId("1:329205582943:web:92c6b6bbf3c3642b421fea")
                .setApiKey("AIzaSyC38thYKR_HIL439l5_wF-I82OIgtTA_p0")
                .setGcmSenderId("329205582943")
                .setStorageBucket("foreai-f9cfa.firebasestorage.app")
                .build()
            FirebaseApp.initializeApp(this, options)
        }
    }
}
