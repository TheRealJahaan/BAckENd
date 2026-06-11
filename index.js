

const express = require('express') 
require('dotenv').config()
const app = express()                         // conputer/ ---get---->.    |___ server
const port = 4000                                               // mobile    <----express--- |                                         //
app.get('/' , (req,res) => {                  //
    res.send('Hello world!')                 //
})                                           //
app.get('/twitter' , (req, res) => {
    res.send('jahaan this side')
})


app.get('/login' , (req , res) => {
    res.send('<h1> please login at chai aur code</h1>')
})
app.get('/youtube' , (req,  res) => {
    res.send("<h2>you will be redirecting to youtube!</h2>")
})
app.listen(process.env.PORT , () => {
    console.log(`Example app listening on port ${port}`)
})
