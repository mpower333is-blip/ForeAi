import React,{useState} from "react";

import {
View,
Text,
TouchableOpacity,
StyleSheet
} from "react-native";

export default function PlayScreen(){

const[
hole,
setHole
]=useState(1);

const[
score,
setScore
]=useState(0);

const[
club,
setClub
]=useState("7 Iron");


const nextHole=()=>{
setHole(hole+1);
};


const logShot=()=>{

setScore(
score+1
);

};

const recommendClub=()=>{
setClub("6 Iron");
};


return(

<View style={styles.container}>

<Text style={styles.title}>
Live Round
</Text>


<View style={styles.card}>

<Text style={styles.hole}>
Hole {hole}
</Text>

<Text style={styles.yardage}>
Par 4 • 410 yards
</Text>

<Text style={styles.club}>
AI Club:
{club}
</Text>

</View>


<TouchableOpacity
style={styles.button}
onPress={recommendClub}
>
<Text style={styles.buttonText}>
Get AI Club
</Text>
</TouchableOpacity>


<TouchableOpacity
style={styles.button}
onPress={logShot}
>
<Text style={styles.buttonText}>
Log Shot
</Text>
</TouchableOpacity>


<TouchableOpacity
style={styles.button}
onPress={nextHole}
>
<Text style={styles.buttonText}>
Next Hole
</Text>
</TouchableOpacity>



<View style={styles.statsCard}>

<Text style={styles.stat}>
Shots This Hole:
{score}
</Text>

<Text style={styles.stat}>
Strokes Gained:
+0.7
</Text>

<Text style={styles.stat}>
Miss Pattern:
Right
</Text>

</View>

</View>

)

}


const styles=
StyleSheet.create({

container:{
flex:1,
justifyContent:"center",
alignItems:"center",
backgroundColor:"#071b13"
},

title:{
fontSize:40,
fontWeight:"800",
color:"#7CFF57"
},

card:{
backgroundColor:"#10261c",
padding:30,
borderRadius:24,
width:"85%",
marginTop:30
},

hole:{
color:"white",
fontSize:32
},

yardage:{
color:"#cfd7cf",
fontSize:22,
marginTop:10
},

club:{
color:"#7CFF57",
fontSize:26,
marginTop:20
},

button:{
backgroundColor:"#7CFF57",
padding:18,
borderRadius:18,
marginTop:20,
width:"75%"
},

buttonText:{
textAlign:"center",
fontWeight:"700"
},

statsCard:{
backgroundColor:"#16362a",
padding:25,
borderRadius:24,
marginTop:30,
width:"85%"
},

stat:{
color:"white",
fontSize:22,
marginTop:12
}

});