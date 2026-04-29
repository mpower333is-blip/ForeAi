import { Router } from "express";
import { getStrategy } from "../lib/courseStrategy";

const router = Router();


// Browser GET test
router.get("/plan",(req,res)=>{

 const strategy = getStrategy({
   holeType:"par4",
   hazard:"water right",
   pinPosition:"back right",
   playerMiss:"right"
 });

 res.json({
   hole:"405 Yard Par 4",
   strategy
 });

});


// POST dynamic strategy endpoint
router.post("/plan",(req,res)=>{

 const strategy = getStrategy({
   holeType:req.body.holeType,
   hazard:req.body.hazard,
   pinPosition:req.body.pinPosition,
   playerMiss:req.body.playerMiss
 });

 res.json({
   strategy
 });

});

export default router;