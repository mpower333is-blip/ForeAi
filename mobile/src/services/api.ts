const API="http://YOUR_LOCAL_IP:5000";

export async function getStrategy(){

 const res=await fetch(
 `${API}/strategy/plan`
 );

 return res.json();

}