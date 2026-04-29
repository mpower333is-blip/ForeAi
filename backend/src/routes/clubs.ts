import { Router } from "express";
import prisma from "../config/db";

const router = Router();


// Add a club
router.post("/add", async(req,res)=>{

 try{

 const club = await prisma.club.create({
   data:{
      userId:req.body.userId,
      name:req.body.name,
      avgCarry:req.body.avgCarry,
      dispersion:req.body.dispersion
   }
 });

 res.json(club);

 } catch(error){

 res.status(500).json({
   error:"Unable to save club"
 });

 }

});


// Get all user clubs
router.get("/:userId", async(req,res)=>{

 const clubs = await prisma.club.findMany({
   where:{
      userId:req.params.userId
   }
 });

 res.json(clubs);

});


export default router;