# Hand transcription of scheduler.mcrl2's process P into Python, explicit-state; a sanity check, not the mCRL2 run.
import sys
from collections import Counter
T=['A','B','C','E','D']; deps={'A':[],'B':['A'],'C':['A'],'E':['A'],'D':['B','C','E']}
w={'A':1,'B':2,'C':3,'E':5,'D':4}; W=2; LV={'u':0,'s':1,'h':2}
def ref(t): return w[t]+sum(ref(d) for d in deps[t])
def run(guard,floor):
  init=(frozenset(),frozenset(),frozenset(),frozenset(),frozenset(),(),0,tuple([0]*5),tuple([0]*5),'u')
  def succ(st):
    off,rdy,prk,comp,ag,runb,inf,cur,vals,mem=st; rc=Counter(runb); out=[]
    for t in T:
      if t not in off and all(d in comp for d in deps[t]):
        if mem!='u' and len(rdy)>=W: out.append((('park',t),(off|{t},rdy,prk|{t},comp,ag,runb,inf,cur,vals,mem)))
        else: out.append((('offer',t),(off|{t},rdy|{t},prk,comp,ag,runb,inf,cur,vals,mem)))
      if t in prk and (mem=='u' or (floor and len(rdy)<W and not(mem=='h' and not(inf==0 and not rdy)))):
        out.append((('unpark',t),(off,rdy|{t},prk-{t},comp,ag,runb,inf,cur,vals,mem)))
      if t in off and t not in rdy and t not in prk and t not in ag:
        out.append((('reoffer',t),(off,rdy|{t},prk,comp,ag|{t},runb,inf,cur,vals,mem)))
      busy=t in comp or rc[t]>0
      if t in rdy and inf<W and guard and busy: out.append((('drop',t),(off,rdy-{t},prk,comp,ag,runb,inf,cur,vals,mem)))
      if t in rdy and inf<W and not(guard and busy):
        c=list(cur); c[T.index(t)]=w[t]+sum(vals[T.index(d)] for d in deps[t])
        out.append((('start',t),(off,rdy-{t},prk,comp,ag,tuple(sorted(runb+(t,))),inf+1,tuple(c),vals,mem)))
      if rc[t]>0:
        for m in LV:
          if LV[m]<=LV[mem]:
            r=list(runb); r.remove(t); v=list(vals); v[T.index(t)]=cur[T.index(t)]
            out.append((('done',t,cur[T.index(t)]),(off,rdy,prk,comp|{t},ag,tuple(r),inf-1,cur,tuple(v),m)))
    if mem!='h': out.append((('pressure',),(off,rdy,prk,comp,ag,runb,inf,cur,vals,'s' if mem=='u' else 'h')))
    if 'D' in comp and not rdy and not prk and inf==0: out.append((('finished',),'END'))
    return out
  # explore; track per-path history abstractions needed: started set, done set (for properties)
  seen=set(); stack=[(init,frozenset(),frozenset())]; ok={'deadlock':True,'once':True,'order':True,'det':True}; n=0
  while stack:
    st,started,dn=stack.pop()
    if (st,started,dn) in seen: continue
    seen.add((st,started,dn)); n+=1
    sc=succ(st)
    if not any(a[0] not in('pressure','reoffer') for a,_ in sc): ok['deadlock']=False
    for a,nx in sc:
      if a[0]=='finished':
        if set(started)!=set(T): ok['once']=False
        continue
      s2,d2=started,dn
      if a[0]=='start':
        if a[1] in started: ok['once']=False
        if not all(d in dn for d in deps[a[1]]): ok['order']=False
        s2=started|{a[1]}
      if a[0]=='done':
        if a[2]!=ref(a[1]): ok['det']=False
        d2=dn|{a[1]}
      stack.append((nx,s2,d2))
  return n,ok
for g,f,name in [(1,1,'scheduler'),(0,1,'no-guard'),(1,0,'no-floor')]: print(name,*run(g,f))
