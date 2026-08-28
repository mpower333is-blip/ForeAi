package com.foreai.wear

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { RoundApp() }
    }
}

@Composable
fun RoundApp(vm: RoundViewModel = viewModel()) {
    // Ask for location once, then keep the GPS running for the rangefinder.
    val context = LocalContext.current
    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) vm.startLocation() }
    LaunchedEffect(Unit) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) vm.startLocation() else permLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    var showClubs by remember { mutableStateOf(false) }

    Scaffold(timeText = { TimeText() }) {
        val ev = vm.event
        when {
            vm.loading && ev == null -> Centered { LoadingView() }
            vm.error != null && ev == null -> Centered { ErrorView(vm.error!!) { vm.retry() } }
            ev == null -> Centered { LoadingView() }
            vm.myPlayerId == null -> PlayerPicker(ev) { vm.setPlayer(it) }
            showClubs -> ClubPicker(vm.selectedClub) { vm.selectClub(it); showClubs = false }
            else -> RoundView(vm, ev, onPickClub = { showClubs = true })
        }
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { item { content() } }
}

@Composable
private fun LoadingView() {
    CircularProgressIndicator()
}

@Composable
private fun ErrorView(msg: String, onRetry: () -> Unit) {
    ScalingLazyColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text(msg, textAlign = TextAlign.Center, style = MaterialTheme.typography.body2) }
        item { Spacer(Modifier.height(6.dp)) }
        item {
            Chip(
                label = { Text("Retry") },
                onClick = onRetry,
                colors = ChipDefaults.primaryChipColors(),
            )
        }
    }
}

@Composable
private fun PlayerPicker(ev: WEvent, onPick: (String) -> Unit) {
    ScalingLazyColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("Who are you?", style = MaterialTheme.typography.title3) }
        item { Spacer(Modifier.height(4.dp)) }
        items(ev.players) { p ->
            Chip(
                label = { Text(p.name.ifBlank { "Player" }) },
                onClick = { onPick(p.id) },
                modifier = Modifier.fillMaxWidth(),
                colors = ChipDefaults.secondaryChipColors(),
            )
        }
        if (ev.players.isEmpty()) {
            item { Text("No players yet — add them on the phone or website.", textAlign = TextAlign.Center) }
        }
    }
}

@Composable
private fun ClubPicker(selected: String?, onPick: (String) -> Unit) {
    ScalingLazyColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("Your club", style = MaterialTheme.typography.title3) }
        items(DEFAULT_BAG) { c ->
            Chip(
                label = { Text(c.name) },
                secondaryLabel = { Text("~${c.meters} m") },
                onClick = { onPick(c.name) },
                modifier = Modifier.fillMaxWidth(),
                colors = if (c.name == selected) ChipDefaults.primaryChipColors()
                else ChipDefaults.secondaryChipColors(),
            )
        }
    }
}

@Composable
private fun RoundView(vm: RoundViewModel, ev: WEvent, onPickClub: () -> Unit) {
    val me = ev.players.firstOrNull { it.id == vm.myPlayerId }
    val scoringId = ev.scoringIdFor(vm.myPlayerId!!)
    val total = ev.scores[scoringId]?.values?.sum() ?: 0
    val h = vm.holeInfo()
    val d = vm.distances()

    ScalingLazyColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("Hole ${vm.viewingHole} · Par ${h.par}", style = MaterialTheme.typography.title2) }

        // Distance to the green — the headline of the watch rangefinder.
        item {
            if (d.hasGps && d.mid != null) {
                Text("${d.mid}", style = MaterialTheme.typography.display1, fontWeight = FontWeight.Bold)
            } else {
                Text("${h.meters}", style = MaterialTheme.typography.display2, fontWeight = FontWeight.Bold)
            }
        }
        item {
            val sub = when {
                d.hasGps && d.mid != null -> {
                    val fb = listOfNotNull(
                        d.front?.let { "F $it" },
                        d.back?.let { "B $it" },
                    ).joinToString("   ")
                    if (fb.isBlank()) "m to green" else "m   $fb"
                }
                d.hasGps -> "m • locating…"
                else -> "m to centre • GPS after survey"
            }
            Text(sub, style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center)
        }
        vm.accuracyM?.let { acc ->
            item { Text("±${acc.toInt()}m", style = MaterialTheme.typography.caption3) }
        }

        // Club selection.
        item {
            Chip(
                label = { Text(vm.selectedClub ?: "Pick your club") },
                secondaryLabel = { Text(if (vm.selectedClub != null) "Change club" else "for this shot") },
                onClick = onPickClub,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                colors = if (vm.selectedClub != null) ChipDefaults.primaryChipColors()
                else ChipDefaults.secondaryChipColors(),
            )
        }

        // Shot logging — tap when you hit; posts club + GPS for the phone to log.
        item {
            Chip(
                label = { Text("＋ Log shot") },
                secondaryLabel = { Text("Shots sent: ${vm.shotsSent}${if (!vm.lastMarkOk) " • retry" else ""}") },
                onClick = { vm.logShotNow() },
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                colors = ChipDefaults.primaryChipColors(),
            )
        }
        item {
            Chip(
                label = { Text(if (vm.autoShots) "Auto: on" else "Auto: off") },
                secondaryLabel = { Text("Detect swings (beta)") },
                onClick = { vm.toggleAuto() },
                modifier = Modifier.fillMaxWidth(),
                colors = if (vm.autoShots) ChipDefaults.primaryChipColors()
                else ChipDefaults.secondaryChipColors(),
            )
        }

        item { Spacer(Modifier.height(4.dp)) }
        item { Text(if (ev.format == "scramble") "Team score" else "Your score", style = MaterialTheme.typography.caption1) }

        // Score stepper: −  N  +
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Button(onClick = { vm.bump(-1) }, enabled = !vm.busy, modifier = Modifier.size(44.dp)) {
                    Text("−", style = MaterialTheme.typography.title1)
                }
                Spacer(Modifier.width(14.dp))
                Text("${vm.displayedScore()}", style = MaterialTheme.typography.display2)
                Spacer(Modifier.width(14.dp))
                Button(onClick = { vm.bump(1) }, enabled = !vm.busy, modifier = Modifier.size(44.dp)) {
                    Text("+", style = MaterialTheme.typography.title1)
                }
            }
        }

        // Hole navigation
        item {
            Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                Chip(label = { Text("‹") }, onClick = { vm.prevHole() }, colors = ChipDefaults.secondaryChipColors())
                Spacer(Modifier.width(8.dp))
                Chip(label = { Text("›") }, onClick = { vm.nextHole() }, colors = ChipDefaults.secondaryChipColors())
            }
        }

        item { Text("Thru ${vm.holesPlayed()} • Total $total", style = MaterialTheme.typography.caption1) }

        item { Spacer(Modifier.height(4.dp)) }
        item {
            Chip(
                label = { Text(me?.name ?: "You") },
                secondaryLabel = { Text("Not you? Change") },
                onClick = { vm.setPlayer(null) },
                modifier = Modifier.fillMaxWidth(),
                colors = ChipDefaults.secondaryChipColors(),
            )
        }
    }
}
