const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const XLSX = require("xlsx");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ================= GAME STATE ================= */

let HOST_CODE = "2395";
let hostSocket = null;

let players = [];
let currentTurnIndex = 0;

let questions = [];

let openedBox = null;

/* ================= UPLOAD ================= */

const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", upload.single("file"), (req, res) => {

  if (!hostSocket || hostSocket.id !== req.headers["x-socket-id"]) {
    return res.status(403).json({ error: "NOT HOST" });
  }

  const wb = XLSX.read(req.file.buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  players = XLSX.utils.sheet_to_json(sheet);
  players.forEach((p, i) => p.STT = i);

  currentTurnIndex = 0;

  io.emit("playerList", players);

  res.json({ count: players.length });
});

/* ================= SOCKET ================= */

io.on("connection", socket => {

  console.log("User:", socket.id);

  /* ===== HOST ===== */

  socket.on("hostJoin", code => {

    if (code !== HOST_CODE) {
      socket.emit("hostFail");
      return;
    }

    hostSocket = socket;
    socket.emit("hostOK");
  });

  /* ===== PLAYER JOIN ===== */

  socket.on("playerJoin", maSV => {

    const p = players.find(x => x.MaSV == maSV);

    if (!p) return socket.emit("joinFail");

    socket.emit("joinOK", p);
  });

  /* ===== START ===== */

  socket.on("startGame", () => {

    if (socket !== hostSocket) return;

    openedBox = null;
    currentTurnIndex = 0;

    io.emit("turn", players[currentTurnIndex]);
  });

  socket.on("nextTurn", () => {

    if (socket !== hostSocket) return;

    currentTurnIndex++;

    if (currentTurnIndex >= players.length) currentTurnIndex = 0;

    openedBox = null;

    io.emit("turn", players[currentTurnIndex]);
  });

  /* ===== OPEN BOX ===== */

  socket.on("open-box", boxId => {

    const me = players.find(p => p.socketId === socket.id);

    if (!me) return;

    if (players[currentTurnIndex].MaSV !== me.MaSV) return;

    if (openedBox !== null) return;

    const q = questions[Math.floor(Math.random() * questions.length)];

    openedBox = boxId;

    io.emit("box-opened", {
      boxId,
      question: q
    });
  });

  /* ===== STAR ===== */

  socket.on("spin-star", () => {

    const me = players.find(p => p.socketId === socket.id);

    if (!me) return;

    if (players[currentTurnIndex].MaSV !== me.MaSV) return;

    const lucky = Math.random() < 0.1;

    io.emit("star-result", { lucky });
  });

  socket.on("disconnect", () => {

    if (socket === hostSocket) hostSocket = null;

  });
});

/* ================= QUESTIONS ================= */

questions = [
  "5đ-Còn gì để mất đâu, liều ăn nhiều thôi nào😇",
  "5.5đ-Nay chưa thắp hương à😘",
  "6đ-Cũng đáng thử ngôi sao may mắn đấy🤔",
  "6.5đ-Có tài rồi bấm ngôi sao xem có xỉu không nào🥰",
  "7đ-Khá quá nhỉ, chắc là thôi chứ ngôi sao gì nữa😘",
  "7.5đ-Hay là thử xem còn may được hơn nữa không😘",
  "8đ-Cao đấy, nhưng mà chưa Tày đâu😂",
  "8.5đ-Chọn Ngôi sao được ăn cả ngã nằm im😘",
  "9đ-Nay chắc hương khói đầy đủ phải không😂",
  "9.5đ-Thầy Huấn sai rồi, không làm mà vẫn có ăn💖"
];

server.listen(3000, () => console.log("Server running 3000"));
