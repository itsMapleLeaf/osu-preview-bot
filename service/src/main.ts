import express from "express"

const app = express()

app.get("/beatmap-preview", (request, response) => {
  response.send("Hello World!")
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.info(`Listening on port ${port}`)
})
