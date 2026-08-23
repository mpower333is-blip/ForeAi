package com.foreai.wear

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// Minimal geo helpers for the watch rangefinder. Distances are in METRES to
// match the phone app (South African golfers play in metres).

data class LatLng(val lat: Double, val lng: Double)

private const val EARTH_RADIUS_M = 6371000.0

fun haversineMeters(a: LatLng, b: LatLng): Double {
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLng = Math.toRadians(b.lng - a.lng)
    val lat1 = Math.toRadians(a.lat)
    val lat2 = Math.toRadians(b.lat)
    val h = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(h)))
}

fun distanceMeters(a: LatLng, b: LatLng): Int = Math.round(haversineMeters(a, b)).toInt()
