package com.foreai.wear

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import androidx.core.content.ContextCompat

// Watch GPS via the platform LocationManager — no Google Play Services needed,
// so it runs on any Wear OS 3+ watch. Reports the latest fix (LatLng) and its
// accuracy in metres to a callback on the main thread.

class LocationProvider(private val context: Context) {

    private val manager =
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

    private var listener: LocationListener? = null

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun start(onFix: (LatLng, Float) -> Unit) {
        if (!hasPermission() || manager == null) return
        stop()
        val l = LocationListener { loc: Location ->
            onFix(LatLng(loc.latitude, loc.longitude), if (loc.hasAccuracy()) loc.accuracy else Float.NaN)
        }
        listener = l
        try {
            // Prefer GPS; fall back to the fused/network provider when present.
            val providers = listOfNotNull(
                LocationManager.GPS_PROVIDER.takeIf { manager.isProviderEnabled(it) },
                LocationManager.NETWORK_PROVIDER.takeIf { manager.isProviderEnabled(it) },
            )
            for (p in providers) {
                manager.requestLocationUpdates(p, 2000L, 1f, l)
                manager.getLastKnownLocation(p)?.let { last ->
                    onFix(LatLng(last.latitude, last.longitude), if (last.hasAccuracy()) last.accuracy else Float.NaN)
                }
            }
        } catch (_: SecurityException) {
            // permission revoked between the check and the request — ignore
        }
    }

    fun stop() {
        listener?.let { manager?.removeUpdates(it) }
        listener = null
    }
}
