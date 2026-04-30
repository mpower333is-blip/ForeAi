import React from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView
} from "react-native";

export default function HomeScreen(){

return(
<ScrollView style={styles.page}>

<View style={styles.hero}>
<Text style={styles.brand}>ForeAi</Text>
<Text style={styles.tag}>
AI Golf Performance Platform
</Text>
</View>


<View style={styles.grid}>

<View style={styles.card}>
<Text style={styles.title}>Live Round</Text>
<Text style={styles.metric}>+1.8 SG</Text>
<Text style={styles.small}>Current Round</Text>
</View>

<View style={styles.card}>
<Text style={styles.title}>Avg Driver</Text>
<Text style={styles.metric}>262</Text>
<Text style={styles.small}>Yards</Text>
</View>

<View style={styles.card}>
<Text style={styles.title}>Fairways</Text>
<Text style={styles.metric}>71%</Text>
<Text style={styles.small}>Hit</Text>
</View>

</View>



<View style={styles.section}>

<Text style={styles.sectionTitle}>
AI Caddie Recommendation
</Text>

<View style={styles.bigCard}>
<Text style={styles.caddie}>
Hole 7:
Hybrid off tee.
8 iron approach.
Favor left side.
</Text>
</View>

</View>



<View style={styles.section}>
<Text style={styles.sectionTitle}>
Strokes Gained Trend
</Text>

<View style={styles.chartMock}>
<Text style={styles.chartText}>
▲ Trending Up
Approach +0.8
Putting +0.4
</Text>
</View>

</View>


<TouchableOpacity style={styles.launchBtn}>
<Text style={styles.launchText}>
Start New Round
</Text>
</TouchableOpacity>


</ScrollView>
)

}

const styles=StyleSheet.create({

page:{
flex:1,
backgroundColor:"#071b13",
padding:30
},

hero:{
marginTop:40,
marginBottom:30
},

brand:{
fontSize:58,
fontWeight:"800",
color:"#7CFF57"
},

tag:{
fontSize:20,
color:"white"
},

grid:{
flexDirection:"row",
flexWrap:"wrap",
gap:20
},

card:{
backgroundColor:"#10261c",
padding:30,
borderRadius:24,
width:260,
marginBottom:20
},

title:{
fontSize:22,
color:"white"
},

metric:{
fontSize:48,
fontWeight:"700",
color:"#7CFF57",
marginTop:15
},

small:{
color:"#c8d1c9"
},

section:{
marginTop:30
},

sectionTitle:{
fontSize:32,
fontWeight:"700",
color:"white",
marginBottom:20
},

bigCard:{
backgroundColor:"#16362a",
padding:35,
borderRadius:30
},

caddie:{
color:"white",
fontSize:24,
lineHeight:40
},

chartMock:{
backgroundColor:"#10261c",
padding:40,
borderRadius:30
},

chartText:{
fontSize:24,
color:"#7CFF57"
},

launchBtn:{
backgroundColor:"#7CFF57",
padding:22,
borderRadius:24,
marginTop:40,
marginBottom:60
},

launchText:{
fontSize:22,
fontWeight:"700",
textAlign:"center"
}

});