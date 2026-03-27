const express = require("express")
const app = express()

app.use(express.json())
app.use(express.static("public"))

let apis = {}

const enc = (s,m)=>s.split("").map(c=>m[c]||c).join("")

const clean = a=>{
  let now=Date.now()
  a.jobs=a.jobs.filter(j=>now-j.t<a.ttl)
}

app.post("/create",(req,res)=>{
  let {name}=req.body
  if(!name) return res.json({err:1})
  if(apis[name]) return res.json({err:"exist"})
  apis[name]={map:{},jobs:[],ttl:60000}
  res.json({api:`/api/${name}`})
})

app.post("/set",(req,res)=>{
  let {name,map,ttl}=req.body
  let a=apis[name]
  if(!a) return res.json({err:1})
  if(map) a.map=map
  if(ttl) a.ttl=ttl
  res.json({ok:1})
})

app.post("/push",(req,res)=>{
  let {name,job,ms,mx,p,sea,players}=req.body
  let a=apis[name]
  if(!a) return res.json({err:1})

  a.jobs.push({
    job:enc(job,a.map),
    ms,mx,p,sea,players,
    t:Date.now()
  })

  clean(a)
  res.json({ok:1})
})

app.get("/api/:n",(req,res)=>{
  let a=apis[req.params.n]
  if(!a) return res.json([])
  clean(a)
  res.json(a.jobs)
})

app.listen(process.env.PORT||3000)
