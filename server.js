const express = require("express")
const app = express()

app.use(express.json())
app.use(express.static("public"))

const OWNER = process.env.OWNER_TOKEN || "dev"

let apis = {}
let owners = {}

const getIP = req => req.headers["x-forwarded-for"] || req.socket.remoteAddress

// encode chuẩn (fix đè)
const enc = (s,m)=>{
  let keys = Object.keys(m).sort((a,b)=>b.length-a.length)
  for(let k of keys){
    s = s.split(k).join(m[k])
  }
  return s
}

const clean = a=>{
  let now = Date.now()
  a.jobs = a.jobs.filter(j => now - j.t < a.ttl)
}

// auto clean
setInterval(()=>{
  for(let k in apis){
    clean(apis[k])
  }
},5000)

// CREATE API
app.post("/create",(req,res)=>{
  let {name} = req.body
  let ip = getIP(req)

  if(!name) return res.json({err:"no name"})
  if(apis[name]) return res.json({err:"exist"})

  apis[name] = {
    map:{},
    jobs:[],
    ttl:60000,
    owner:ip
  }

  if(!owners[ip]) owners[ip]=[]
  owners[ip].push(name)

  res.json({api:`/api/${name}`})
})

// SETTINGS
app.post("/set",(req,res)=>{
  let {name,map,ttl} = req.body
  let a = apis[name]

  if(!a) return res.json({err:"no api"})

  if(map) a.map = map
  if(ttl) a.ttl = ttl * 1000

  res.json({ok:1})
})

// PUSH JOB
app.post("/push",(req,res)=>{
  let {name,job,ms,mx,p,sea,players} = req.body
  let a = apis[name]

  if(!a) return res.json({err:"no api"})

  let encoded = enc(job,a.map)

  // tránh trùng
  if(a.jobs.find(x=>x.job===encoded)) return res.json({ok:1})

  a.jobs.push({
    job:encoded,
    ms,mx,p,sea,players,
    t:Date.now()
  })

  clean(a)
  res.json({ok:1})
})

// GET API
app.get("/api/:n",(req,res)=>{
  let a = apis[req.params.n]
  if(!a) return res.json([])

  clean(a)
  res.json(a.jobs)
})

// MY API (theo IP)
app.get("/my",(req,res)=>{
  let ip = getIP(req)
  res.json(owners[ip] || [])
})

// OWNER PANEL
app.post("/owner",(req,res)=>{
  let {token} = req.body
  if(token !== OWNER) return res.json({err:"nope"})

  res.json(apis)
})

app.listen(process.env.PORT || 3000)
