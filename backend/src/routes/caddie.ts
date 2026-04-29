import { Router } from "express";
import { recommendClub } from "../lib/clubRecommendation";

const router = Router();

router.post("/recommend",(req,res)=>{

 const club = recommendClub({
   yardage:req.body.yardage,
   wind:req.body.wind,
   lie:req.body.lie
 });

 res.json({
   recommendation:club,
   strategy:"Aim center green."
 });

});

export default router;