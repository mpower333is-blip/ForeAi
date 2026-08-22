package com.foreai.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
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
    Scaffold(timeText = { TimeText() }) {
        val ev = vm.event
        when {
            vm.loading && ev == null -> Centered { LoadingView() }
            vm.error != null && ev == null -> Centered { ErrorView(vm.error!!) { vm.retry() } }
            ev == null -> Centered { LoadingView() }
            vm.myPlayerId == null -> PlayerPicker(ev) { vm.setPlayer(it) }
            else -> RoundView(vm, ev)
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
private fun RoundView(vm: RoundViewModel, ev: WEvent) {
    val me = ev.players.firstOrNull { it.id == vm.myPlayerId }
    val scoringId = ev.scoringIdFor(vm.myPlayerId!!)
    val total = ev.scores[scoringId]?.values?.sum() ?: 0

    ScalingLazyColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("Hole ${vm.viewingHole}", style = MaterialTheme.typography.title2) }

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

        item {
            Text(
                if (ev.format == "scramble") "Team score" else "Your score",
                style = MaterialTheme.typography.caption2,
            )
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
