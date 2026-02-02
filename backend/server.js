const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const cors=require("cors");
const multer=require("multer");
const XLSX=require("xlsx");

const app=express();
app.use(cors());

const server=http.createServer(app);

const io=new Server(server,{
 cors:{origin:"*"}
});

const upload=multer({dest:"uploads/"});

/* ================= STATE ================= */

const HOST_CODE="2395";

let hostSocket=null;
let students=[];
let currentTurnIndex=0;

let openedBox=null;
let starUsed=false;

/* ================= UPLOAD ================= */

app.post("/upload",upload.single("file"),(req,res)=>{
 if(!hostSocket) return res.status(403).json({err:"not host"});

 const wb=XLSX.readFile(req.file.path);
 const sheet=wb.Sheets[wb.SheetNames[0]];
 const data=XLSX.utils.sheet_to_json(sheet);

 students=data.map((r,i)=>({
  STT:i+1,
  MaSV:r.MaSV,
  Ten:r.Ten
 }));

 currentTurnIndex=0;
 openedBox=null;
 starUsed=false;

 io.emit("syncState",{
  currentTurn:students[0]||null,
  openedBox:null,
  starUsed:false
 });

 res.json({count:students.length});
});

/* ================= SOCKET ================= */

io.on("connection",socket=>{

 console.log("connect",socket.id);

 socket.on("disconnect",()=>{
  if(socket.id===hostSocket){
   hostSocket=null;
   console.log("HOST LEFT");
  }
 });

 /* ===== HOST LOGIN ===== */
 socket.on("hostJoin",code=>{
  if(code===HOST_CODE){
   hostSocket=socket.id;
   socket.emit("hostOK");
  }else{
   socket.emit("hostFail");
  }
 });

 /* ===== PLAYER JOIN ===== */
 socket.on("playerJoin",ma=>{
  const st=students.find(s=>s.MaSV===ma);
  if(!st) return socket.emit("joinFail");

  socket.player=st;
  socket.emit("joinOK",st);
 });

 /* ===== START GAME ===== */
 socket.on("startGame",()=>{
  if(socket.id!==hostSocket) return;
  if(!students.length) return;

  currentTurnIndex=0;
  openedBox=null;
  starUsed=false;

  io.emit("syncState",{
   currentTurn:students[0],
   openedBox:null,
   starUsed:false
  });

  io.emit("turn",students[0]);
 });

 /* ===== NEXT TURN ===== */
 socket.on("nextTurn",()=>{
  if(socket.id!==hostSocket) return;

  currentTurnIndex++;
  if(currentTurnIndex>=students.length) return;

  openedBox=null;
  starUsed=false;

  io.emit("syncState",{
   currentTurn:students[currentTurnIndex],
   openedBox:null,
   starUsed:false
  });

  io.emit("turn",students[currentTurnIndex]);
 });

 /* ===== OPEN BOX ===== */
 socket.on("chooseCell",({index})=>{

  if(!socket.player) return;

  const cur=students[currentTurnIndex];
  if(!cur) return;

  if(socket.player.MaSV!==cur.MaSV) return;

  if(openedBox!==null) return;

  openedBox=index;

  const q=randomQuestion();

  io.emit("boxOpened",{
   index,
   question:q.text,
   score:q.score
  });

 });

 /* ===== STAR ===== */
 socket.on("spinStar",()=>{

  if(!socket.player) return;

  const cur=students[currentTurnIndex];
  if(!cur) return;

  if(socket.player.MaSV!==cur.MaSV) return;

  if(starUsed) return;

  starUsed=true;

  const win=Math.random()<0.1;

  io.emit("starResult",{win});
 });

});

/* ================= QUESTION BANK ================= */

const questions=[
 {text:"5đ-Còn gì để mất đâu",score:"5"},
 {text:"5.5đ-Nay chưa thắp hương à",score:"5.5"},
 {text:"6đ-Cũng đáng thử",score:"6"},
 {text:"6.5đ-Có tài rồi",score:"6.5"},
 {text:"7đ-Khá quá",score:"7"},
 {text:"7.5đ-Thử tiếp",score:"7.5"},
 {text:"8đ-Cao đấy",score:"8"},
 {text:"8.5đ-Chọn sao",score:"8.5"},
 {text:"9đ-Hương khói đầy",score:"9"},
 {text:"9.5đ-Khỏi làm",score:"9.5"},
];

function randomQuestion(){
 return questions[Math.floor(Math.random()*questions.length)];
}

/* ================= START ================= */

server.listen(3000,()=>{
 console.log("Server running 3000");
});
