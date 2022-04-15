const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
let rooms = require("./rooms");
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("create_room", (data) => {
    isRoomAlreadyPresent = rooms.find(
      (room) => room.roomName === data.roomName
    );
    if (isRoomAlreadyPresent) {
      socket.emit("room_create_status", {
        isRoomAlreadyPresent: true,
        message: "Room already exists",
      });
    } else {
      rooms.push({
        roomName: data.roomName,
        players: [],
      });
      socket.emit("room_create_status", {
        isRoomAlreadyPresent: false,
        message: "Room created successfully.",
      });
    }
  });

  socket.on("join_room", (data) => {
    const totalPlayersInRoom =
      rooms.filter((room) => room.roomName === data.roomName)[0]?.players
        .length || 0;
    if (totalPlayersInRoom < 2) {
      socket.join(data.roomName);
      socket.data.roomName = data.roomName;

      rooms = rooms.map((room) => {
        console.log(room, "in map", data, "data");
        if (room.roomName === data.roomName) {
          room.players.push({ name: data.username, socketId: socket.id });
        }
        return room;
      });

      const room = rooms.find((room) => room.roomName === data.roomName);
      socket.emit("room_status", {
        totalPlayersInRoom: room?.players?.length || 0,
        room: room,
        isMoveAllowed: room?.players?.length == 2,
      });

      socket.on("game_state", (state) => {
        const winner = calculateWinner(state.squares);
        const isGameFinished =
          state.squares.filter((value) => Boolean(value)).length === 9;
        if (winner || isGameFinished) {
          socket.emit("game_over", {
            isGameFinished: true,
            gameOverMessage: `${winner} is a winner` || "It's a Draw",
          });
          socket.to(data.roomName).emit("game_over", {
            isGameFinished: true,
            gameOverMessage: `${winner} is a winner` || "It's a Draw",
          });
        }
        socket.to(data.roomName).emit("game_state", state);
      });

      console.log(`User with ID: ${socket.id} joined room: ${data}`, rooms);
    } else {
      console.log("running this", socket.id);
      socket.emit("room_occupied", { isRoomOccupied: true });
    }
  });

  socket.on("disconnect", () => {
    rooms = rooms.map((room) => {
      if (room.roomName === socket.data.roomName) {
        room.players = room.players.filter(
          (player) => player.socketId != socket.id
        );
      }
      return room;
    });
    socket.to().emit("player_left", { socketId: socket.id });
  });

  socket.on("send_message", (data) => {
    socket.to(data.room).emit("receive_message", data);
  });
});

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

server.listen(3001, () => {
  console.log("SERVER RUNNING");
});
