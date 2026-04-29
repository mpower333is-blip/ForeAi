import { Router } from "express";
import prisma from "../config/db";
import { calcStrokesGained } from "../lib/strokesGained";

const router = Router();

router.post("/add", async(req,res)=>{

 try{

 const strokesGained = calcStrokesGained(
   req.body.yardage,
   req.body.actualStrokes
 );

 const shot = await prisma.shot.create({
   data:{
      roundId:req.body.roundId,
      hole:req.body.hole,
      club:req.body.club,
      yardage:req.body.yardage,
      lie:req.body.lie,
      result:req.body.result,
      strokesGained
   }
 });

 res.json(shot);

 } catch(error){
   console.log(error);
   res.status(500).json({
      error:"Failed to save shot"
   });
 }

});

export default router;