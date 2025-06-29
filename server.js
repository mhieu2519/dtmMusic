const express = require("express")

const server = express()

server.get("/", (req, res) => {
  res.send("Bot Music is running!")
})

function keepAlive() {
  const port = process.env.PORT || 4000; // ⚠ Dùng PORT từ biến môi trường
  server.listen(port, () => {
    console.log(`✅ Server is ready on port ${port}.`);
  });
}

module.exports = keepAlive
