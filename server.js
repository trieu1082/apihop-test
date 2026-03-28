const express = require("express")
const app = express()

app.use(express.json())
app.use(express.static("public"))

const PORT = process.env.PORT || 3000
const OWNER_TOKEN = process.env.OWNER_TOKEN
if(!OWNER_TOKEN) throw "missing OWNER_TOKEN"

const DB = {
  apis:{},
  users:{},
  sessions:{}
}

const getIP = req => (req.headers["x-forwarded-for"]||"").split(",")[0] || req.socket.remoteAddress

function encode(str,map){
  if(!map) return str
  return str.split("").map(c=>map[c]||c).join("")
}

function genToken(){
  return Math.random().toString(36).slice(2)
}

app.post("/register",(req,res)=>{
  let {user,pass}=req.body
  if(!user||!pass) return res.json({err:"missing"})
  if(DB.users[user]) return res.json({err:"exist"})
  DB.users[user]={pass}
  res.json({ok:1})
})

app.post("/login",(req,res)=>{
  let {user,pass}=req.body

  if(user==="owner" && pass===OWNER_TOKEN){
    let tk=genToken()
    DB.sessions[tk]="OWNER"
    return res.json({token:tk,role:"owner"})
  }

  let u=DB.users[user]
  if(!u||u.pass!==pass) return res.json({err:"wrong"})

  let tk=genToken()
  DB.sessions[tk]=user
  res.json({token:tk,role:"user"})
})

app.post("/create",(req,res)=>{
  let {name}=req.body
  let ip=getIP(req)

  if(!name) return res.json({err:"no name"})
  if(DB.apis[name]) return res.json({err:"exist"})

  DB.apis[name]={
    jobs:[],
    encode:null,
    ttl:60000,
    ownerIP:ip
  }

  res.json({ok:1,link:`/api/${encodeURIComponent(name)}`})
})

app.post("/push",(req,res)=>{
  let {name,job,ms,mx,players,sea}=req.body
  let api=DB.apis[name]
  if(!api) return res.json({err:"no api"})

  job=encode(job,api.encode)

  api.jobs.push({
    job,ms,mx,players,sea,
    t:Date.now()
  })

  res.json({ok:1})
})

app.get("/api/:name",(req,res)=>{
  let api=DB.apis[req.params.name]
  if(!api) return res.json([])

  let now=Date.now()
  api.jobs=api.jobs.filter(j=>now-j.t<api.ttl)

  res.json(api.jobs)
})

app.post("/settings",(req,res)=>{
  let {name,encodeMap,ttl}=req.body
  let api=DB.apis[name]
  let ip=getIP(req)

  if(!api) return res.json({err:"no api"})
  if(api.ownerIP!==ip) return res.json({err:"not owner"})

  if(encodeMap) api.encode=encodeMap
  if(ttl) api.ttl=ttl

  res.json({ok:1})
})

app.get("/owner",(req,res)=>{
  let tk=req.headers.authorization
  if(DB.sessions[tk]!=="OWNER") return res.json({err:"no"})

  res.json({
    users:DB.users,
    apis:DB.apis
  })
})

app.post("/owner/edit",(req,res)=>{
  let tk=req.headers.authorization
  if(DB.sessions[tk]!=="OWNER") return res.json({err:"no"})

  let {name,encodeMap,ttl}=req.body
  let api=DB.apis[name]
  if(!api) return res.json({err:"no api"})

  if(encodeMap) api.encode=encodeMap
  if(ttl) api.ttl=ttl

  res.json({ok:1})
})

app.listen(PORT,()=>console.log("run",PORT))
