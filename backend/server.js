
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server,{cors:{origin:"*"}});

const upload = multer({storage: multer.memoryStorage()});

let hostSocket=null;
let students=[]; // [{STT,MaSV,Ten}]
let players={}; // socketId -> student
let currentIndex=0;
let gameStarted=false;

app.post("/upload", upload.single("file"), (req,res)=>{
  const wb = XLSX.read(req.file.buffer,{type:"buffer"});
  const ws = wb.Sheets[wb.SheetNames[0]];
  students = XLSX.utils.sheet_to_json(ws);
  res.json({ok:true,count:students.length});
});

io.on("connection",(socket)=>{
  socket.on("hostJoin",(code)=>{
    if(code==="2395"){
      hostSocket=socket.id;
      socket.emit("hostOK");
    } else socket.emit("hostFail");
  });

  socket.on("playerJoin",(maSV)=>{
    const st = students.find(s=>String(s.MaSV)===String(maSV));
    if(!st) return socket.emit("joinFail");
    players[socket.id]=st;
    socket.emit("joinOK",st);
    io.emit("players",Object.values(players));
  });

  socket.on("startGame",()=>{
    if(socket.id!==hostSocket) return;
    gameStarted=true;
    currentIndex=0;
    io.emit("turn",students[currentIndex]);
  });

  socket.on("nextTurn",()=>{
    if(socket.id!==hostSocket) return;
    currentIndex++;
    if(currentIndex>=students.length){
      io.emit("gameEnd");
    } else io.emit("turn",students[currentIndex]);
  });

  socket.on("chooseCell",(data)=>{
    const current = students[currentIndex];
    const me = players[socket.id];
    if(!gameStarted || !me || me.STT!==current.STT) return;
    io.emit("cellChosen",{by:me,...data});
  });

  socket.on("disconnect",()=>{
    delete players[socket.id];
  });
});

server.listen(3000,()=>console.log("Server running 3000"));
