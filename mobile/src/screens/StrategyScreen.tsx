import React,{useState} from "react";
import {
View,
Text,
TouchableOpacity,
StyleSheet
} from "react-native";

import {getStrategy}
from "../services/api";

export default function StrategyScreen(){

const[
strategy,
setStrategy
]=useState("");

const loadStrategy=async()=>{

const data=await getStrategy();

setStrategy(
data.strategy
);

}

return(

<View style={styles.container}>

<Text style={styles.title}>
AI Course Strategy
</Text>

<TouchableOpacity
style={styles.button}
onPress={loadStrategy}
>
<Text style={styles.buttonText}>
Analyze Hole
</Text>
</TouchableOpacity>

{strategy!==""&&(
<View style={styles.resultCard}>
<Text style={styles.result}>
{strategy}
</Text>
</View>
)}

</View>

)

}

const styles=StyleSheet.create({

container:{
flex:1,
justifyContent:"center",
alignItems:"center",
backgroundColor:"#071b13"
},

title:{
fontSize:36,
fontWeight:"700",
color:"white"
},

button:{
backgroundColor:"#7CFF57",
paddingHorizontal:30,
paddingVertical:18,
borderRadius:20,
marginTop:25
},

buttonText:{
fontWeight:"700"
},

resultCard:{
backgroundColor:"#10261c",
padding:30,
borderRadius:24,
marginTop:40,
width:"80%"
},

result:{
color:"white",
fontSize:22,
textAlign:"center"
}

});