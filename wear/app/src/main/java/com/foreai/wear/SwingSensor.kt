package com.foreai.wear

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs
import kotlin.math.sqrt

// Detects a golf swing from the watch accelerometer — the wrist feels the swing
// even with the phone in the cart. A swing/impact spikes hard (well above 1g);
// we fire on that spike with a refractory gap so one swing counts once. Telling
// a practice swing from a real one is left to the phone: it only turns a mark
// into a shot once you've MOVED to your ball, so extra marks at one spot are
// harmless.
class SwingSensor(context: Context) : SensorEventListener {
    private val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val accel = sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private var onSwing: (() -> Unit)? = null
    private var lastSpike = 0L

    fun start(onSwing: () -> Unit) {
        this.onSwing = onSwing
        accel?.let { sm?.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    fun stop() {
        sm?.unregisterListener(this)
        onSwing = null
    }

    override fun onSensorChanged(e: SensorEvent) {
        val magG = sqrt(e.values[0] * e.values[0] + e.values[1] * e.values[1] + e.values[2] * e.values[2]) /
            SensorManager.GRAVITY_EARTH
        val dyn = abs(magG - 1f) // g's above/below gravity
        val now = System.currentTimeMillis()
        if (dyn > SWING_G && now - lastSpike > REFRACTORY_MS) {
            lastSpike = now
            onSwing?.invoke()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    companion object {
        const val SWING_G = 2.0f // a wrist swing/impact spikes ≥ ~2g
        const val REFRACTORY_MS = 2000L
    }
}
