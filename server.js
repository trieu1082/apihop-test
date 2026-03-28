const express = require("express")
const app = express()

app.use(express.json())
app.use(express.static("public"))

const PORT = process.env.PORT || 3000
const OWNER_TOKEN = process.env.OWNER_TOKEN
if(!OWNER_TOKEN) throw "missing OWNER_TOKEN"

const DB = {apis:{},users:{},sessions:{}}

const encode = (s,m)=>{
  if(!m) return s
  s = String(s)
  return s.split("").map(c=>m[c]||c).join("")
}

const genToken = ()=>Math.random().toString(36).slice(2)
const genID = ()=>Math.random().toString(36).slice(2)

const getIP = r => (r.headers["x-forwarded-for"]||"").split(",")[0] || r.socket.remoteAddress
const genGuest = ip => "Khach"+(ip.replace(/\D/g,"").slice(-5)||Math.floor(Math.random()*99999))

const parseText = t=>{
  let o={}
  t.split("\n").forEach(l=>{
    let [k,v]=l.split("=")
    if(k&&v)o[k.trim()]=v.trim()
  })
  return Object.keys(o).length?o:null
}

const getSession = r => DB.sessions[r.headers.authorization]
const getUser = r => getSession(r)?.user
const isOwner = r => getSession(r)?.role==="OWNER"

app.post("/register",(req,res)=>{
  let {user,pass}=req.body
  if(!user||!pass) return res.json({err:"missing"})
  if(DB.users[user]) return res.json({err:"exist"})
  DB.users[user]={pass}
  res.json({ok:1})
})

app.post("/login",(req,res)=>{
  let {user,pass}=req.body

  if(pass===OWNER_TOKEN){
    let tk=genToken()
    DB.sessions[tk]={user:user||"owner",role:"OWNER"}
    return res.json({token:tk,role:"owner"})
  }

  let u=DB.users[user]
  if(!u||u.pass!==pass) return res.json({err:"wrong"})

  let tk=genToken()
  DB.sessions[tk]={user,role:"user"}
  res.json({token:tk,role:"user"})
})

app.get("/me",(req,res)=>{
  let s=getSession(req)
  if(s) return res.json({user:s.user,role:s.role})
  res.json({guest:genGuest(getIP(req))})
})

app.post("/create",(req,res)=>{
  let {name}=req.body
  let user=getUser(req)

  if(!user) return res.json({err:"login"})
  if(!name) return res.json({err:"no name"})
  if(/[^\w]/.test(name)) return res.json({err:"invalid"})

  let id=genID()

  DB.apis[id]={
    id,
    name,
    owner:user,
    jobs:[],
    encode:null,
    ttl:60000
  }

  res.json({ok:1,id,link:`/api/${id}`})
})

app.get("/my",(req,res)=>{
  let user=getUser(req)
  if(!user) return res.json([])
  res.json(Object.values(DB.apis).filter(a=>a.owner===user))
})

app.post("/push",(req,res)=>{
  let {id,job,players,sea,boss}=req.body
  let api=DB.apis[id]

  if(!api) return res.json({err:"no api"})
  if(!job) return res.json({err:"no job"})
  if(!boss) return res.json({err:"no boss"})

  job = encode(job, api.encode)
  boss = boss.toLowerCase()

  api.jobs.push({
    job,
    players,
    sea,
    boss,
    t: Date.now()
  })

  res.json({ok:1})
})

app.get("/api/:id",(req,res)=>{
  let api=DB.apis[req.params.id]
  if(!api) return res.json([])

  let now=Date.now()
  let boss=req.query.boss

  api.jobs = api.jobs.filter(j=>now-j.t<api.ttl)

  let out = boss
    ? api.jobs.filter(j=>j.boss===boss.toLowerCase())
    : api.jobs

  res.json(out)
})

app.post("/settings",(req,res)=>{
  let {id,encodeText,ttl}=req.body
  let user=getUser(req)

  let api=DB.apis[id]
  if(!api) return res.json({err:"no api"})
  if(api.owner!==user) return res.json({err:"no perm"})

  if(encodeText!==undefined) api.encode=parseText(encodeText)
  if(ttl!==undefined) api.ttl=ttl

  res.json({ok:1})
})

app.get("/owner",(req,res)=>{
  if(!isOwner(req)) return res.json({err:"no"})
  res.json({users:DB.users,apis:DB.apis})
})

app.post("/owner/edit",(req,res)=>{
  if(!isOwner(req)) return res.json({err:"no"})

  let {id,encodeText,ttl}=req.body
  let api=DB.apis[id]
  if(!api) return res.json({err:"no api"})

  if(encodeText!==undefined) api.encode=parseText(encodeText)
  if(ttl!==undefined) api.ttl=ttl

  res.json({ok:1})
})

app.listen(PORT,()=>console.log("run",PORT))
