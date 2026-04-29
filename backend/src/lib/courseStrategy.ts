type StrategyInput = {
 holeType:string;
 hazard:string;
 pinPosition:string;
 playerMiss:string;
};

export function getStrategy(
 input:StrategyInput
){

 let strategy="";

 if(
   input.hazard==="water right"
   && input.playerMiss==="right"
 ){
   strategy=
   "Favor left side. Club down for control.";
}

else if(
 input.pinPosition==="back right"
){
 strategy=
 "Aim center green. Do not chase tucked pin.";
}

else{
 strategy=
 "Play aggressive to target.";
}

 return strategy;

}