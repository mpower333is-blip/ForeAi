import expectedStrokes from "../data/expectedStrokes";

export function getExpectedStrokes(yardage:number){

 if(yardage <=50) return expectedStrokes[50];
 if(yardage <=100) return expectedStrokes[100];
 if(yardage <=150) return expectedStrokes[150];
 if(yardage <=200) return expectedStrokes[200];

 return expectedStrokes[250];
}

export function calcStrokesGained(
 yardage:number,
 actualStrokes:number
){
 const expected = getExpectedStrokes(yardage);

 return expected - actualStrokes;
}