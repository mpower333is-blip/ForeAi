import clubDistances from "../data/clubDistances";

type ShotInput={
 yardage:number;
 wind:number;
 lie:string;
}

export function recommendClub(
 input:ShotInput
){

 let adjusted=input.yardage;

 if(input.wind >10)
   adjusted+=10;

 if(input.lie==="rough")
   adjusted+=5;

 let recommendation="";

 for(const [club,distance] of Object.entries(clubDistances)){

   if(adjusted<=distance){
      recommendation=club;
      break;
   }

 }

 return recommendation || "5 Iron";
}